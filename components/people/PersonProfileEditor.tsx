"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { US_STATES } from "@/utils/usStates";

export type EditablePerson = {
  id: string;
  linked_user_id: string | null;
  created_by_user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  is_living: boolean | null;
  bio: string | null;
  profile_photo_path: string | null;
  cover_photo_path: string | null;
  cover_photo_position_x: number | null;
  cover_photo_position_y: number | null;
  profile_summary: string | null;
  notes: string | null;
  sex: string | null;
  birth_city: string | null;
  birth_state: string | null;
  birth_place: string | null;
  death_city: string | null;
  death_state: string | null;
  death_place: string | null;
  burial_date: string | null;
  burial_city: string | null;
  burial_state: string | null;
  burial_place: string | null;
  christening_date: string | null;
  christening_city: string | null;
  christening_state: string | null;
  christening_place: string | null;
  baptism_date: string | null;
  baptism_city: string | null;
  baptism_state: string | null;
  baptism_place: string | null;
};

export type ProfilePhotoHistoryItem = {
  id: string;
  storage_path: string;
  file_name: string | null;
  is_current: boolean;
  created_at: string;
  signedUrl: string | null;
};

export type AlternateName = {
  id: string;
  name: string;
  name_type: string | null;
  notes: string | null;
};

export type LifeEvent = {
  id: string;
  event_type: string;
  title: string;
  event_date: string | null;
  event_place: string | null;
  description: string | null;
};

type PersonProfileEditorProps = {
  person: EditablePerson;
  userId: string;
  canEdit: boolean;
  personName: string;
  initials: string;
  isDeceased: boolean;
  isOnline: boolean;
  showAccountLink: boolean;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  profilePhotoHistory: ProfilePhotoHistoryItem[];
  alternateNames: AlternateName[];
  lifeEvents: LifeEvent[];
};

const LIFE_EVENT_TYPES = [
  "occupation",
  "residence",
  "education",
  "military_service",
  "immigration",
  "marriage",
  "graduation",
  "retirement",
  "custom",
];

function getSafeImagePath(userId: string, personId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

  return `${userId}/${personId}/${crypto.randomUUID()}.${extension}`;
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatEventType(type: string) {
  return type
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function clampPosition(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeSex(value: string | null) {
  if (!value) return "";

  const normalized = value.trim().toLowerCase();

  if (normalized === "male" || normalized === "m") return "Male";
  if (normalized === "female" || normalized === "f") return "Female";

  return "";
}

function formatPlace(city: string | null, state: string | null, fallback: string | null) {
  const structuredPlace = [city, state].filter(Boolean).join(", ");

  return structuredPlace || fallback;
}

export default function PersonProfileEditor({
  person,
  userId,
  canEdit,
  personName,
  initials,
  isDeceased,
  isOnline,
  showAccountLink,
  profilePhotoUrl,
  coverPhotoUrl,
  profilePhotoHistory,
  alternateNames,
  lifeEvents,
}: PersonProfileEditorProps) {
  return (
    <>
      <ProfileHeader
        person={person}
        userId={userId}
        canEdit={canEdit}
        personName={personName}
        initials={initials}
        isDeceased={isDeceased}
        isOnline={isOnline}
        showAccountLink={showAccountLink}
        profilePhotoUrl={profilePhotoUrl}
        coverPhotoUrl={coverPhotoUrl}
        profilePhotoHistory={profilePhotoHistory}
      />

      <div className="mt-6 space-y-6">
        <CoreFactsCard person={person} canEdit={canEdit} />

        <LifeStoryCard person={person} canEdit={canEdit} />

        <OtherInformationCard
          person={person}
          userId={userId}
          canEdit={canEdit}
          alternateNames={alternateNames}
          lifeEvents={lifeEvents}
        />
      </div>
    </>
  );
}

export function ProfileHeader({
  person,
  userId,
  canEdit,
  personName,
  initials,
  isDeceased,
  isOnline,
  showAccountLink,
  profilePhotoUrl,
  coverPhotoUrl,
  profilePhotoHistory,
}: {
  person: EditablePerson;
  userId: string;
  canEdit: boolean;
  personName: string;
  initials: string;
  isDeceased: boolean;
  isOnline: boolean;
  showAccountLink: boolean;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  profilePhotoHistory: ProfilePhotoHistoryItem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFrameRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [isSavingProfilePhoto, setIsSavingProfilePhoto] = useState(false);
  const [showPhotoHistory, setShowPhotoHistory] = useState(false);
  const [isCoverMenuOpen, setIsCoverMenuOpen] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [coverPosition, setCoverPosition] = useState({
    x: clampPosition(Number(person.cover_photo_position_x ?? 50)),
    y: clampPosition(Number(person.cover_photo_position_y ?? 50)),
  });
  const [draftCoverPosition, setDraftCoverPosition] = useState(coverPosition);
  const [summary, setSummary] = useState(person.profile_summary ?? "");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [dragStart, setDragStart] = useState<{
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
  } | null>(null);

  async function uploadCoverPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) return;

    setIsSavingCover(true);
    setMessage("");

    const storagePath = getSafeImagePath(userId, person.id, file);
    const { error: uploadError } = await supabase.storage
      .from("person-cover-photos")
      .upload(storagePath, file, {
        cacheControl: "31536000",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setIsSavingCover(false);
      return;
    }

    const { error } = await supabase
      .from("people")
      .update({
        cover_photo_path: storagePath,
        cover_photo_position_x: 50,
        cover_photo_position_y: 50,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      await supabase.storage.from("person-cover-photos").remove([storagePath]);
      setMessage(error.message);
      setIsSavingCover(false);
      return;
    }

    setIsSavingCover(false);
    setCoverPosition({ x: 50, y: 50 });
    setDraftCoverPosition({ x: 50, y: 50 });
    router.refresh();
  }

  async function removeCoverPhoto() {
    setIsSavingCover(true);
    setMessage("");

    const { error } = await supabase
      .from("people")
      .update({
        cover_photo_path: null,
        cover_photo_position_x: 50,
        cover_photo_position_y: 50,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSavingCover(false);
      return;
    }

    setIsSavingCover(false);
    setIsCoverMenuOpen(false);
    router.refresh();
  }

  function startRepositioning() {
    setDraftCoverPosition(coverPosition);
    setIsRepositioning(true);
    setIsCoverMenuOpen(false);
  }

  function handleCoverPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isRepositioning) return;

    const target = event.target as HTMLElement;

    if (target.closest("button")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: draftCoverPosition.x,
      positionY: draftCoverPosition.y,
    });
  }

  function handleCoverPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isRepositioning || !dragStart || !coverFrameRef.current) return;

    const bounds = coverFrameRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragStart.pointerX) / bounds.width) * 100;
    const deltaY = ((event.clientY - dragStart.pointerY) / bounds.height) * 100;

    setDraftCoverPosition({
      x: clampPosition(dragStart.positionX - deltaX),
      y: clampPosition(dragStart.positionY - deltaY),
    });
  }

  function handleCoverPointerUp() {
    setDragStart(null);
  }

  async function saveCoverPosition() {
    setIsSavingCover(true);
    setMessage("");

    const { error } = await supabase
      .from("people")
      .update({
        cover_photo_position_x: draftCoverPosition.x,
        cover_photo_position_y: draftCoverPosition.y,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSavingCover(false);
      return;
    }

    setCoverPosition(draftCoverPosition);
    setIsRepositioning(false);
    setIsSavingCover(false);
    router.refresh();
  }

  async function saveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSummary(true);
    setMessage("");

    const { error } = await supabase
      .from("people")
      .update({
        profile_summary: summary.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSavingSummary(false);
      return;
    }

    setIsEditingSummary(false);
    setIsSavingSummary(false);
    router.refresh();
  }

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) return;

    setIsSavingProfilePhoto(true);
    setMessage("");

    const storagePath = getSafeImagePath(userId, person.id, file);
    const { error: uploadError } = await supabase.storage
      .from("person-photos")
      .upload(storagePath, file, {
        cacheControl: "31536000",
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    const { error: resetError } = await supabase
      .from("person_profile_photos")
      .update({ is_current: false })
      .eq("person_id", person.id)
      .eq("uploaded_by_user_id", userId);

    if (resetError) {
      setMessage(resetError.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("person_profile_photos")
      .insert({
        person_id: person.id,
        uploaded_by_user_id: userId,
        storage_path: storagePath,
        file_name: file.name,
        is_current: true,
      });

    if (insertError) {
      await supabase.storage.from("person-photos").remove([storagePath]);
      setMessage(insertError.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    const { error } = await supabase
      .from("people")
      .update({
        profile_photo_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    setIsSavingProfilePhoto(false);
    router.refresh();
  }

  async function revertProfilePhoto(photo: ProfilePhotoHistoryItem) {
    setIsSavingProfilePhoto(true);
    setMessage("");

    const { error: resetError } = await supabase
      .from("person_profile_photos")
      .update({ is_current: false })
      .eq("person_id", person.id)
      .eq("uploaded_by_user_id", userId);

    if (resetError) {
      setMessage(resetError.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    const { error: currentError } = await supabase
      .from("person_profile_photos")
      .update({ is_current: true })
      .eq("id", photo.id)
      .eq("uploaded_by_user_id", userId);

    if (currentError) {
      setMessage(currentError.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    const { error } = await supabase
      .from("people")
      .update({
        profile_photo_path: photo.storage_path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSavingProfilePhoto(false);
      return;
    }

    setIsSavingProfilePhoto(false);
    router.refresh();
  }

  return (
    <header className="mt-6 overflow-hidden rounded-3xl border border-night-sky/10 bg-white shadow-sm">
      <div
        ref={coverFrameRef}
        onPointerDown={handleCoverPointerDown}
        onPointerMove={handleCoverPointerMove}
        onPointerUp={handleCoverPointerUp}
        onPointerCancel={handleCoverPointerUp}
        className={`group relative h-44 bg-gradient-to-br from-sky/80 via-teal/70 to-leaf/65 sm:h-56 lg:h-64 ${
          isRepositioning ? "cursor-grab touch-none" : ""
        }`}
      >
        {coverPhotoUrl && (
          <Image
            src={coverPhotoUrl}
            alt=""
            width={1200}
            height={360}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${draftCoverPosition.x}% ${draftCoverPosition.y}%`,
            }}
            unoptimized
            priority
          />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-t from-night-sky/30 to-transparent"
          aria-hidden="true"
        />

        {isRepositioning && (
          <div className="absolute inset-x-4 bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-night-sky/80 px-4 py-3 text-sm text-white backdrop-blur">
            <span>Drag the photo to reposition it.</span>
            <div className="flex gap-2">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setDraftCoverPosition(coverPosition);
                  setDragStart(null);
                  setIsRepositioning(false);
                }}
                className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={saveCoverPosition}
                disabled={isSavingCover}
                className="rounded-xl bg-sky px-4 py-2 font-semibold text-white hover:brightness-105 disabled:opacity-60"
              >
                {isSavingCover ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {canEdit && !isRepositioning && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadCoverPhoto}
            />
            <div className="absolute right-4 top-4 z-20 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setIsCoverMenuOpen((current) => !current)}
                disabled={isSavingCover}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-lg text-night-sky shadow-sm backdrop-blur hover:bg-white"
                aria-label="Edit cover photo"
              >
                ✎
              </button>

              {isCoverMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-night-sky/10 bg-white py-2 text-sm text-night-sky shadow-lg">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="block w-full px-4 py-2 text-left font-semibold hover:bg-sand"
                  >
                    {coverPhotoUrl ? "Change cover photo" : "Add cover photo"}
                  </button>
                  {coverPhotoUrl && (
                    <>
                      <button
                        type="button"
                        onClick={startRepositioning}
                        className="block w-full px-4 py-2 text-left font-semibold hover:bg-sand"
                      >
                        Reposition cover photo
                      </button>
                      <button
                        type="button"
                        onClick={removeCoverPhoto}
                        className="block w-full px-4 py-2 text-left font-semibold text-coral hover:bg-sand"
                      >
                        Remove cover photo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="relative px-6 pb-6 pt-16 lg:px-8 lg:pb-8">
        <div className="absolute -top-16 left-6 lg:left-8">
          <div className="group relative h-32 w-32">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-sky/15 text-4xl font-black text-night-sky ring-4 ring-white">
              {profilePhotoUrl ? (
                <Image
                  src={profilePhotoUrl}
                  alt={personName}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                  unoptimized
                  priority
                />
              ) : (
                initials
              )}
            </div>

            {!isDeceased && (
              <span
                className={`pointer-events-none absolute -bottom-1 -right-1 z-30 h-7 w-7 rounded-full border-4 border-white shadow-sm ${
                  isOnline ? "bg-sky" : "bg-night-sky/25"
                }`}
                title={isOnline ? "Online" : "Offline"}
                aria-label={isOnline ? "Online" : "Offline"}
              />
            )}

            {canEdit && (
              <>
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadProfilePhoto}
                />
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  disabled={isSavingProfilePhoto}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-night-sky/55 text-4xl font-black text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Upload profile photo"
                >
                  +
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-night-sky lg:text-5xl">
              {personName}
            </h1>
            {isEditingSummary ? (
              <form onSubmit={saveSummary} className="mt-3 max-w-3xl space-y-3">
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Add a short introduction for this person."
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingSummary}
                    className="button-primary px-4 py-2 text-xs"
                  >
                    {isSavingSummary ? "Saving..." : "Save summary"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSummary(person.profile_summary ?? "");
                      setIsEditingSummary(false);
                    }}
                    className="button-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 max-w-3xl">
                {person.profile_summary ? (
                  <p className="text-base leading-7 text-night-sky/70">
                    {person.profile_summary}
                  </p>
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingSummary(true)}
                    className="text-sm font-semibold text-sky-depth hover:underline"
                  >
                    Add a short introduction for this person.
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {showAccountLink && (
              <Link href="/profile" className="button-secondary">
                Manage account
              </Link>
            )}

            {canEdit && !isEditingSummary && person.profile_summary && (
              <button
                type="button"
                onClick={() => setIsEditingSummary(true)}
                className="button-secondary"
              >
                Edit summary
              </button>
            )}

            {canEdit && profilePhotoHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPhotoHistory((current) => !current)}
                className="button-secondary"
              >
                Photo history
              </button>
            )}

            {isDeceased && (
              <button type="button" disabled className="button-secondary">
                Suggest correction
              </button>
            )}
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
            {message}
          </p>
        )}

        {canEdit && showPhotoHistory && (
          <div className="mt-6 rounded-2xl border border-night-sky/10 bg-sand/55 p-4">
            <p className="text-sm font-semibold text-night-sky">
              Previous profile photos
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {profilePhotoHistory.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => revertProfilePhoto(photo)}
                  disabled={isSavingProfilePhoto || photo.is_current}
                  className={`relative h-20 w-20 overflow-hidden rounded-xl border ${
                    photo.is_current
                      ? "border-sky ring-2 ring-sky/30"
                      : "border-night-sky/10"
                  }`}
                  aria-label="Use this profile photo"
                >
                  {photo.signedUrl ? (
                    <Image
                      src={photo.signedUrl}
                      alt=""
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-white text-xs text-night-sky/45">
                      Photo
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export function CoreFactsCard({
  person,
  canEdit,
}: {
  person: EditablePerson;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    first_name: person.first_name ?? "",
    last_name: person.last_name ?? "",
    sex: normalizeSex(person.sex),
    birth_date: person.birth_date ?? "",
    birth_city: person.birth_city ?? "",
    birth_state: person.birth_state ?? "",
    death_date: person.death_date ?? "",
    death_city: person.death_city ?? "",
    death_state: person.death_state ?? "",
    burial_date: person.burial_date ?? "",
    burial_city: person.burial_city ?? "",
    burial_state: person.burial_state ?? "",
    christening_date: person.christening_date ?? "",
    christening_city: person.christening_city ?? "",
    christening_state: person.christening_state ?? "",
    baptism_date: person.baptism_date ?? "",
    baptism_city: person.baptism_city ?? "",
    baptism_state: person.baptism_state ?? "",
  });

  const factRows = [
    ["Full name", [person.first_name, person.last_name].filter(Boolean).join(" ")],
    ["Sex", normalizeSex(person.sex)],
    ["Birth date", formatDate(person.birth_date)],
    [
      "Birth place",
      formatPlace(person.birth_city, person.birth_state, person.birth_place),
    ],
    ["Death date", formatDate(person.death_date)],
    [
      "Death place",
      formatPlace(person.death_city, person.death_state, person.death_place),
    ],
    ["Burial date", formatDate(person.burial_date)],
    [
      "Burial place",
      formatPlace(person.burial_city, person.burial_state, person.burial_place),
    ],
    ["Christening date", formatDate(person.christening_date)],
    [
      "Christening place",
      formatPlace(
        person.christening_city,
        person.christening_state,
        person.christening_place
      ),
    ],
    ["Baptism date", formatDate(person.baptism_date)],
    [
      "Baptism place",
      formatPlace(person.baptism_city, person.baptism_state, person.baptism_place),
    ],
  ].filter(([, value]) => Boolean(value));

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveFacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const displayName = [form.first_name, form.last_name]
      .filter(Boolean)
      .join(" ");

    const { error } = await supabase
      .from("people")
      .update({
        first_name: form.first_name,
        last_name: form.last_name || null,
        display_name: displayName || form.first_name,
        sex: form.sex || null,
        birth_date: form.birth_date || null,
        birth_city: form.birth_city || null,
        birth_state: form.birth_state || null,
        death_date: form.death_date || null,
        death_city: form.death_city || null,
        death_state: form.death_state || null,
        burial_date: form.burial_date || null,
        burial_city: form.burial_city || null,
        burial_state: form.burial_state || null,
        christening_date: form.christening_date || null,
        christening_city: form.christening_city || null,
        christening_state: form.christening_state || null,
        baptism_date: form.baptism_date || null,
        baptism_city: form.baptism_city || null,
        baptism_state: form.baptism_state || null,
        is_living: form.death_date ? false : person.is_living,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-night-sky">Core facts</h2>
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="button-secondary px-4 py-2 text-xs"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={saveFacts} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="First name" value={form.first_name} required onChange={(value) => updateField("first_name", value)} />
            <TextInput label="Last name" value={form.last_name} onChange={(value) => updateField("last_name", value)} />
            <SelectInput
              label="Sex"
              value={form.sex}
              options={[
                { value: "", label: "Select sex" },
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
              ]}
              onChange={(value) => updateField("sex", value)}
            />
            <DateInput label="Birth date" value={form.birth_date} onChange={(value) => updateField("birth_date", value)} />
            <PlaceInputs
              label="Birth place"
              city={form.birth_city}
              state={form.birth_state}
              onCityChange={(value) => updateField("birth_city", value)}
              onStateChange={(value) => updateField("birth_state", value)}
            />
            <DateInput label="Death date" value={form.death_date} onChange={(value) => updateField("death_date", value)} />
            <PlaceInputs
              label="Death place"
              city={form.death_city}
              state={form.death_state}
              onCityChange={(value) => updateField("death_city", value)}
              onStateChange={(value) => updateField("death_state", value)}
            />
            <DateInput label="Burial date" value={form.burial_date} onChange={(value) => updateField("burial_date", value)} />
            <PlaceInputs
              label="Burial place"
              city={form.burial_city}
              state={form.burial_state}
              onCityChange={(value) => updateField("burial_city", value)}
              onStateChange={(value) => updateField("burial_state", value)}
            />
            <DateInput label="Christening date" value={form.christening_date} onChange={(value) => updateField("christening_date", value)} />
            <PlaceInputs
              label="Christening place"
              city={form.christening_city}
              state={form.christening_state}
              onCityChange={(value) => updateField("christening_city", value)}
              onStateChange={(value) => updateField("christening_state", value)}
            />
            <DateInput label="Baptism date" value={form.baptism_date} onChange={(value) => updateField("baptism_date", value)} />
            <PlaceInputs
              label="Baptism place"
              city={form.baptism_city}
              state={form.baptism_state}
              onCityChange={(value) => updateField("baptism_city", value)}
              onStateChange={(value) => updateField("baptism_state", value)}
            />
          </div>

          {message && (
            <p className="rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving} className="button-primary">
              {isSaving ? "Saving..." : "Save facts"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="button-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : factRows.length > 0 ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {factRows.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-night-sky/10 bg-sand/55 px-4 py-3"
            >
              <dt className="text-xs font-bold uppercase tracking-[0.14em] text-night-sky/45">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-night-sky">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <EmptyState>The essentials are waiting to be filled in.</EmptyState>
      )}
    </section>
  );
}

export function LifeStoryCard({
  person,
  canEdit,
}: {
  person: EditablePerson;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(person.bio ?? "");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveBio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("people")
      .update({
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-night-sky">Life story</h2>
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="button-secondary px-4 py-2 text-xs"
          >
            {person.bio ? "Edit" : "Add life story"}
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={saveBio} className="mt-5 space-y-4">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={8}
            placeholder="Add the story, memories, and details that help this person feel known."
          />

          {message && (
            <p className="rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving} className="button-primary">
              {isSaving ? "Saving..." : "Save story"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="button-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : person.bio ? (
        <p className="mt-5 whitespace-pre-line text-sm leading-7 text-night-sky/75">
          {person.bio}
        </p>
      ) : (
        <EmptyState>
          Every story starts somewhere. Add a few details to help this
          person&apos;s story take shape.
        </EmptyState>
      )}
    </section>
  );
}

export function OtherInformationCard({
  person,
  userId,
  canEdit,
  alternateNames,
  lifeEvents,
}: {
  person: EditablePerson;
  userId: string;
  canEdit: boolean;
  alternateNames: AlternateName[];
  lifeEvents: LifeEvent[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [notes, setNotes] = useState(person.notes ?? "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [message, setMessage] = useState("");
  const [nameForm, setNameForm] = useState({
    id: "",
    name: "",
    name_type: "",
    notes: "",
  });
  const [eventForm, setEventForm] = useState({
    id: "",
    event_type: "occupation",
    title: "",
    event_date: "",
    event_place: "",
    description: "",
  });

  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase
      .from("people")
      .update({
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setIsEditingNotes(false);
    router.refresh();
  }

  async function saveAlternateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!nameForm.name.trim()) return;

    const payload = {
      person_id: person.id,
      created_by_user_id: userId,
      name: nameForm.name.trim(),
      name_type: nameForm.name_type.trim() || null,
      notes: nameForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = nameForm.id
      ? await supabase
          .from("person_alternate_names")
          .update(payload)
          .eq("id", nameForm.id)
      : await supabase.from("person_alternate_names").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNameForm({ id: "", name: "", name_type: "", notes: "" });
    router.refresh();
  }

  async function saveLifeEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!eventForm.title.trim()) return;

    const payload = {
      person_id: person.id,
      created_by_user_id: userId,
      event_type: eventForm.event_type,
      title: eventForm.title.trim(),
      event_date: eventForm.event_date || null,
      event_place: eventForm.event_place.trim() || null,
      description: eventForm.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = eventForm.id
      ? await supabase
          .from("person_life_events")
          .update(payload)
          .eq("id", eventForm.id)
      : await supabase.from("person_life_events").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEventForm({
      id: "",
      event_type: "occupation",
      title: "",
      event_date: "",
      event_place: "",
      description: "",
    });
    router.refresh();
  }

  async function deleteRow(table: "person_alternate_names" | "person_life_events", id: string) {
    setMessage("");

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-night-sky">
        Other information
      </h2>

      {message && (
        <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
          {message}
        </p>
      )}

      <div className="mt-5 space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-night-sky">
            Alternate names
          </h3>
          {alternateNames.length === 0 ? (
            <p className="mt-2 text-sm text-night-sky/55">
              No alternate names added yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {alternateNames.map((name) => (
                <div
                  key={name.id}
                  className="rounded-xl border border-night-sky/10 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-night-sky">
                        {name.name}
                      </p>
                      {(name.name_type || name.notes) && (
                        <p className="mt-1 text-sm text-night-sky/55">
                          {[name.name_type, name.notes].filter(Boolean).join(" - ")}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNameForm({
                              id: name.id,
                              name: name.name,
                              name_type: name.name_type ?? "",
                              notes: name.notes ?? "",
                            })
                          }
                          className="text-xs font-bold uppercase tracking-[0.12em] text-sky-depth"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow("person_alternate_names", name.id)}
                          className="text-xs font-bold uppercase tracking-[0.12em] text-coral"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <form onSubmit={saveAlternateName} className="mt-4 grid gap-3 md:grid-cols-[1fr_0.7fr]">
              <TextInput label="Name" value={nameForm.name} onChange={(value) => setNameForm((current) => ({ ...current, name: value }))} />
              <TextInput label="Type" value={nameForm.name_type} placeholder="Nickname, maiden name..." onChange={(value) => setNameForm((current) => ({ ...current, name_type: value }))} />
              <div className="md:col-span-2">
                <TextInput label="Notes" value={nameForm.notes} onChange={(value) => setNameForm((current) => ({ ...current, notes: value }))} />
              </div>
              <div className="flex gap-3 md:col-span-2">
                <button type="submit" className="button-secondary px-4 py-2 text-xs">
                  {nameForm.id ? "Save name" : "Add name"}
                </button>
                {nameForm.id && (
                  <button
                    type="button"
                    onClick={() => setNameForm({ id: "", name: "", name_type: "", notes: "" })}
                    className="button-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-night-sky">
            Life events
          </h3>
          {lifeEvents.length === 0 ? (
            <p className="mt-2 text-sm text-night-sky/55">
              No occupations, residences, or other life events added yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {lifeEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-night-sky/10 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-night-sky/45">
                        {formatEventType(event.event_type)}
                      </p>
                      <p className="mt-1 font-semibold text-night-sky">
                        {event.title}
                      </p>
                      <p className="mt-1 text-sm text-night-sky/55">
                        {[formatDate(event.event_date), event.event_place]
                          .filter(Boolean)
                          .join(" - ")}
                      </p>
                      {event.description && (
                        <p className="mt-2 text-sm leading-6 text-night-sky/65">
                          {event.description}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEventForm({
                              id: event.id,
                              event_type: event.event_type,
                              title: event.title,
                              event_date: event.event_date ?? "",
                              event_place: event.event_place ?? "",
                              description: event.description ?? "",
                            })
                          }
                          className="text-xs font-bold uppercase tracking-[0.12em] text-sky-depth"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow("person_life_events", event.id)}
                          className="text-xs font-bold uppercase tracking-[0.12em] text-coral"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <form onSubmit={saveLifeEvent} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-night-sky">
                  Event type
                </label>
                <select
                  value={eventForm.event_type}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      event_type: event.target.value,
                    }))
                  }
                  className="mt-2"
                >
                  {LIFE_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEventType(type)}
                    </option>
                  ))}
                </select>
              </div>
              <TextInput label="Title" value={eventForm.title} onChange={(value) => setEventForm((current) => ({ ...current, title: value }))} />
              <DateInput label="Date" value={eventForm.event_date} onChange={(value) => setEventForm((current) => ({ ...current, event_date: value }))} />
              <TextInput label="Place" value={eventForm.event_place} onChange={(value) => setEventForm((current) => ({ ...current, event_place: value }))} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-night-sky">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-3 md:col-span-2">
                <button type="submit" className="button-secondary px-4 py-2 text-xs">
                  {eventForm.id ? "Save event" : "Add event"}
                </button>
                {eventForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setEventForm({
                        id: "",
                        event_type: "occupation",
                        title: "",
                        event_date: "",
                        event_place: "",
                        description: "",
                      })
                    }
                    className="button-secondary px-4 py-2 text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-night-sky">Notes</h3>
            {canEdit && !isEditingNotes && (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className="button-secondary px-4 py-2 text-xs"
              >
                {person.notes ? "Edit" : "Add notes"}
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <form onSubmit={saveNotes} className="mt-3 space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Private notes, context, or research reminders."
              />
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="button-secondary px-4 py-2 text-xs">
                  Save notes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(false)}
                  className="button-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : person.notes ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-night-sky/65">
              {person.notes}
            </p>
          ) : (
            <p className="mt-2 text-sm text-night-sky/55">
              No notes added yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-night-sky">
        {label}
      </label>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-night-sky">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PlaceInputs({
  label,
  city,
  state,
  onCityChange,
  onStateChange,
}: {
  label: string;
  city: string;
  state: string;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-night-sky/10 p-3">
      <legend className="px-1 text-sm font-medium text-night-sky">
        {label}
      </legend>
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <input
          type="text"
          value={city}
          placeholder="City"
          onChange={(event) => onCityChange(event.target.value)}
        />
        <select
          value={state}
          onChange={(event) => onStateChange(event.target.value)}
        >
          {US_STATES.map((stateOption) => (
            <option key={stateOption.value} value={stateOption.value}>
              {stateOption.label}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-night-sky">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-xl bg-sand px-4 py-5 text-sm leading-6 text-night-sky/65">
      {children}
    </p>
  );
}
