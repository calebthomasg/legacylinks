"use client";

import { useState } from "react";

type GalleryImage = {
  id: string;
  signedUrl: string | null;
  fileName: string | null;
  dateAdded: string;
  entryTitle: string;
  entryCreatedAt: string | null;
};

type ImageGalleryProps = {
  images: GalleryImage[];
};

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  function formatDate(dateString: string | null) {
    if (!dateString) return "Unknown date";

    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <>
      {images.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-950">
            No images yet
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">
            Once you add pictures to your journal entries, they will appear here
            in your gallery.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedImage(image)}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-square bg-gray-100">
                {image.signedUrl ? (
                  <img
                    src={image.signedUrl}
                    alt={image.fileName ?? "Journal image"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-gray-500">
                    Image unavailable
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="text-sm font-semibold text-gray-950">
                  {image.entryTitle}
                </p>

                <p className="mt-2 text-xs text-gray-500">
                  Added {formatDate(image.dateAdded)}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Entry date {formatDate(image.entryCreatedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
          <div className="relative w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-950 shadow"
            >
              Close
            </button>

            <div className="overflow-hidden rounded-xl bg-gray-100">
              {selectedImage.signedUrl ? (
                <img
                  src={selectedImage.signedUrl}
                  alt={selectedImage.fileName ?? "Journal image"}
                  className="max-h-[75vh] w-full object-contain"
                />
              ) : (
                <div className="flex h-96 items-center justify-center text-sm text-gray-500">
                  Image unavailable
                </div>
              )}
            </div>

            <div className="mt-4">
              <h2 className="text-xl font-semibold text-gray-950">
                {selectedImage.entryTitle}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Added {formatDate(selectedImage.dateAdded)}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                From entry dated {formatDate(selectedImage.entryCreatedAt)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}