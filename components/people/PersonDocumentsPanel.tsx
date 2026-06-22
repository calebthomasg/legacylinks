"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type PersonDocument = {
  id: string;
  storage_path: string;
  file_name: string;
  document_name: string;
  document_category: string;
  document_date: string | null;
  description: string | null;
  created_at: string;
};

type PersonDocumentsPanelProps = {
  personId: string;
  userId: string;
  documents: PersonDocument[];
};

const DOCUMENT_CATEGORIES = [
  "birth certificate",
  "death certificate",
  "marriage license",
  "census record",
  "military record",
  "obituary",
  "driver's license",
  "passport",
  "baptism/christening record",
  "immigration record",
  "naturalization record",
  "school record",
  "yearbook",
  "newspaper clipping",
  "cemetery record",
  "funeral program",
  "family Bible record",
  "will/probate record",
  "land/property record",
  "adoption record",
  "other",
];

const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
].join(",");

function getSafeFileName(fileName: string) {
  const [baseName, extension] = [
    fileName.replace(/\.[^/.]+$/, "") || "document",
    fileName.split(".").pop()?.toLowerCase() || "file",
  ];

  const safeBaseName =
    baseName
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document";

  return `${safeBaseName}.${extension}`;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Unknown date";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCategory(category: string) {
  return category
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function PersonDocumentsPanel({
  personId,
  userId,
  documents,
}: PersonDocumentsPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState("birth certificate");
  const [documentDate, setDocumentDate] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(
    null
  );

  function chooseFile(file: File | null) {
    setSelectedFile(file);

    if (file && !documentName.trim()) {
      setDocumentName(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  async function openDocument(document: PersonDocument) {
    setOpeningDocumentId(document.id);
    setMessage("");

    const { data, error } = await supabase.storage
      .from("person-documents")
      .createSignedUrl(document.storage_path, 60 * 10);

    setOpeningDocumentId(null);

    if (error || !data?.signedUrl) {
      setMessage(error?.message ?? "Could not open this document.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setMessage("Choose a document before uploading.");
      return;
    }

    setIsUploading(true);
    setMessage("");

    const safeFileName = getSafeFileName(selectedFile.name);
    const storagePath = `${userId}/${personId}/${crypto.randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("person-documents")
      .upload(storagePath, selectedFile, {
        cacheControl: "31536000",
        contentType: selectedFile.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("person_documents")
      .insert({
        person_id: personId,
        uploaded_by_user_id: userId,
        storage_path: storagePath,
        file_name: selectedFile.name,
        document_name: documentName.trim() || selectedFile.name,
        document_category: documentCategory,
        document_date: documentDate || null,
        description: description.trim() || null,
      });

    if (insertError) {
      await supabase.storage.from("person-documents").remove([storagePath]);
      setMessage(insertError.message);
      setIsUploading(false);
      return;
    }

    setSelectedFile(null);
    setDocumentName("");
    setDocumentCategory("birth certificate");
    setDocumentDate("");
    setDescription("");
    setMessage("Document uploaded.");
    setIsUploading(false);
    router.refresh();
  }

  return (
    <section
      id="sources-research"
      className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-2xl font-semibold text-night-sky">
          Sources & Research
        </h2>
        <p className="mt-2 text-sm leading-6 text-night-sky/65">
          Keep certificates, records, clippings, and other supporting documents
          close to this person&apos;s story.
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="mt-5 rounded-xl bg-sand px-4 py-5 text-sm leading-6 text-night-sky/65">
          No research documents have been uploaded yet. A record, clipping, or
          certificate can help anchor this story in time.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-night-sky/10">
          <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_90px] gap-4 bg-sand px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-night-sky/50 md:grid">
            <span>Document</span>
            <span>Category</span>
            <span>Date</span>
            <span>Action</span>
          </div>

          <div className="divide-y divide-night-sky/10">
            {documents.map((document) => (
              <div
                key={document.id}
                className="grid gap-3 px-4 py-4 text-sm text-night-sky/75 md:grid-cols-[1.4fr_1fr_0.8fr_90px] md:items-center"
              >
                <div>
                  <p className="font-semibold text-night-sky">
                    {document.document_name}
                  </p>
                  {document.description && (
                    <p className="mt-1 text-xs leading-5 text-night-sky/55">
                      {document.description}
                    </p>
                  )}
                </div>

                <p>{formatCategory(document.document_category)}</p>
                <p>{document.document_date ? formatDate(document.document_date) : "Not dated"}</p>

                <button
                  type="button"
                  onClick={() => openDocument(document)}
                  disabled={openingDocumentId === document.id}
                  className="button-secondary px-3 py-2 text-xs"
                >
                  {openingDocumentId === document.id ? "Opening..." : "View"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={uploadDocument} className="mt-6 space-y-4">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className="rounded-2xl border-2 border-dashed border-night-sky/15 bg-sand/60 px-4 py-6 text-center"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_DOCUMENT_TYPES}
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />

          <p className="text-sm font-semibold text-night-sky">
            {selectedFile ? selectedFile.name : "Drag a document here"}
          </p>
          <p className="mt-1 text-xs leading-5 text-night-sky/55">
            PDF, image, and common record scans work best for now.
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="button-secondary mt-4"
          >
            Choose file
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-night-sky">
              Document name
            </label>
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              className="mt-2"
              placeholder="Birth certificate, obituary, census record..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-night-sky">
              Category
            </label>
            <select
              value={documentCategory}
              onChange={(event) => setDocumentCategory(event.target.value)}
              className="mt-2"
            >
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {formatCategory(category)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-night-sky">
            Document date
          </label>
          <input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
            className="mt-2 max-w-xs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-night-sky">
            Notes
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-2"
            placeholder="Add context, source details, or where this record came from."
          />
        </div>

        {message && (
          <p className="rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="button-primary"
        >
          {isUploading ? "Uploading..." : "Upload document"}
        </button>
      </form>
    </section>
  );
}
