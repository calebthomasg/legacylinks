"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  getJournalImageStoragePath,
  MAX_JOURNAL_ENTRY_IMAGES,
  optimizeJournalImage,
} from "@/utils/images/client";

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  profilePhotoUrl: string | null;
};

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  entry_date: string | null;
  taggedPersonIds: string[];
  images: {
    id: string;
    storage_path: string;
    file_name: string | null;
    signedUrl: string | null;
  }[];
};

type DashboardJournalComposerProps = {
  userFirstName: string;
  people: PersonOption[];
  entries: JournalEntry[];
};

function getPersonName(person: PersonOption) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getEntryDateKey(entry: JournalEntry) {
  const date = entry.entry_date ? new Date(`${entry.entry_date}T00:00:00`) : new Date(entry.created_at);
  return getDateKey(date);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatShortMonthDay(date: Date) {
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);

  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
  }).format(date);

  return `${month}. ${day}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getGreeting(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function buildCalendar(currentDate: Date, entries: JournalEntry[]) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const firstWeekday = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const entryDateSet = new Set(entries.map((entry) => getEntryDateKey(entry)));
  const today = new Date();
  const todayKey = getDateKey(today);

  const cells: {
    key: string;
    date: Date | null;
    label: number | null;
    hasEntry: boolean;
    isToday: boolean;
    isEmpty: boolean;
  }[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      key: `empty-start-${i}`,
      date: null,
      label: null,
      hasEntry: false,
      isToday: false,
      isEmpty: true,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    const key = getDateKey(date);

    cells.push({
      key,
      date,
      label: day,
      hasEntry: entryDateSet.has(key),
      isToday: key === todayKey,
      isEmpty: false,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `empty-end-${cells.length}`,
      date: null,
      label: null,
      hasEntry: false,
      isToday: false,
      isEmpty: true,
    });
  }

  const weeks = [];

  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

function calculateStreak(entries: JournalEntry[]) {
  const loggedDateKeys = new Set(entries.map((entry) => getEntryDateKey(entry)));

  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let streak = 0;

  while (true) {
    const key = getDateKey(cursor);

    if (!loggedDateKeys.has(key)) {
      break;
    }

    streak += 1;

    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() - 1
    );
  }

  return streak;
}

export default function DashboardJournalComposer({
  userFirstName,
  people,
  entries,
}: DashboardJournalComposerProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [now, setNow] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<JournalEntry["images"]>([]);

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const entriesByDateKey = useMemo(() => {
    const map = new Map<string, JournalEntry>();

    entries.forEach((entry) => {
      const key = getEntryDateKey(entry);

      if (!map.has(key)) {
        map.set(key, entry);
      }
    });

    return map;
  }, [entries]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedEntry = entriesByDateKey.get(selectedDateKey) ?? null;
  const previewUrls = useMemo(() => {
    return selectedFiles.map((file) => URL.createObjectURL(file));
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const syncSelection = window.setTimeout(() => {
      if (selectedEntry) {
        setActiveEntryId(selectedEntry.id);
        setBody(selectedEntry.body ?? "");
        setSelectedPersonIds(selectedEntry.taggedPersonIds ?? []);
        setExistingImages(selectedEntry.images ?? []);
        setSelectedFiles([]);
        setMessage("");
        return;
      }

      setActiveEntryId(null);
      setBody("");
      setSelectedPersonIds([]);
      setExistingImages([]);
      setSelectedFiles([]);
      setMessage("");
    }, 0);

    return () => {
      window.clearTimeout(syncSelection);
    };
  }, [selectedEntry, selectedDateKey]);

  const calendarWeeks = useMemo(
    () => buildCalendar(calendarDate, entries),
    [calendarDate, entries]
  );

  const streak = useMemo(() => calculateStreak(entries), [entries]);

  const selectedPeople = people.filter((person) =>
    selectedPersonIds.includes(person.id)
  );

  function goToPreviousMonth() {
    setCalendarDate((current) => {
      return new Date(current.getFullYear(), current.getMonth() - 1, 1);
    });
  }

  function goToNextMonth() {
    setCalendarDate((current) => {
      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
    });
  }

  function goToCurrentMonth() {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDate(today);
  }

  function handleCalendarDateClick(date: Date) {
    setSelectedDate(date);
  }

  function togglePerson(personId: string) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const availableSlots =
      MAX_JOURNAL_ENTRY_IMAGES - existingImages.length - selectedFiles.length;

    if (availableSlots <= 0) {
      setMessage(`You can add up to ${MAX_JOURNAL_ENTRY_IMAGES} photos per entry.`);
      event.target.value = "";
      return;
    }

    if (files.length > availableSlots) {
      setMessage(
        `Only ${availableSlots} more photo${
          availableSlots === 1 ? "" : "s"
        } can be added to this entry.`
      );
    } else {
      setMessage("");
    }

    setSelectedFiles((current) => [...current, ...files.slice(0, availableSlots)]);
    event.target.value = "";
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleSave() {
    if (!body.trim() && selectedFiles.length === 0 && existingImages.length === 0) {
      setMessage("Write something or add a photo before saving.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("You must be logged in to save an entry.");
        return;
      }

      if (existingImages.length + selectedFiles.length > MAX_JOURNAL_ENTRY_IMAGES) {
        setMessage(`You can add up to ${MAX_JOURNAL_ENTRY_IMAGES} photos per entry.`);
        return;
      }

      const entryDate = toDateInputValue(selectedDate);
      const entryTitle = `${formatLongDate(selectedDate)} Journal Entry`;

      let entryId = activeEntryId;

      if (entryId) {
        const { error: updateError } = await supabase
          .from("journal_entries")
          .update({
            title: entryTitle,
            body: body.trim(),
            entry_date: entryDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entryId)
          .eq("user_id", user.id);

        if (updateError) {
          setMessage(updateError.message);
          return;
        }

        const { error: deleteTagsError } = await supabase
          .from("journal_entry_people")
          .delete()
          .eq("journal_entry_id", entryId)
          .eq("tagged_by_user_id", user.id);

        if (deleteTagsError) {
          setMessage(deleteTagsError.message);
          return;
        }
      } else {
        const { data: newEntry, error: entryError } = await supabase
          .from("journal_entries")
          .insert({
            user_id: user.id,
            title: entryTitle,
            body: body.trim(),
            entry_date: entryDate,
          })
          .select("id")
          .single();

        if (entryError || !newEntry) {
          setMessage(entryError?.message ?? "Could not save journal entry.");
          return;
        }

        entryId = newEntry.id;
      }

      if (!entryId) {
        setMessage("Could not save journal entry.");
        return;
      }

      if (selectedPersonIds.length > 0) {
        const tagRows = selectedPersonIds.map((personId) => ({
          journal_entry_id: entryId,
          person_id: personId,
          tagged_by_user_id: user.id,
        }));

        const { error: tagError } = await supabase
          .from("journal_entry_people")
          .insert(tagRows);

        if (tagError) {
          setMessage(tagError.message);
          return;
        }
      }

      if (selectedFiles.length > 0) {
        setMessage(`Optimizing ${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"}...`);

        const imageRows = [];

        for (let index = 0; index < selectedFiles.length; index += 1) {
          const originalFile = selectedFiles[index];
          const uploadFile = await optimizeJournalImage(originalFile);
          const storagePath = getJournalImageStoragePath(
            user.id,
            entryId,
            uploadFile
          );

          setMessage(`Uploading photo ${index + 1} of ${selectedFiles.length}...`);

          const { error: uploadError } = await supabase.storage
            .from("journal-images")
            .upload(storagePath, uploadFile, {
              cacheControl: "31536000",
              contentType: uploadFile.type || originalFile.type,
              upsert: false,
            });

          if (uploadError) {
            setMessage(
              `Photo ${index + 1} could not upload: ${uploadError.message}`
            );
            return;
          }

          imageRows.push({
            journal_entry_id: entryId,
            user_id: user.id,
            storage_path: storagePath,
            file_name: originalFile.name,
          });
        }

        const { error: imageRowError } = await supabase
          .from("journal_entry_images")
          .insert(imageRows);

        if (imageRowError) {
          setMessage(imageRowError.message);
          return;
        }
      }

      setSelectedFiles([]);
      setMessage("Journal entry saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving this journal entry."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const allPhotoPreviews = [
    ...existingImages
      .map((image) => image.signedUrl)
      .filter((url): url is string => Boolean(url)),
    ...previewUrls,
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="relative min-h-36 overflow-visible pr-28 sm:min-h-44 sm:pr-56 lg:pr-72">
          <Image
            src="/images/stars.svg"
            alt=""
            width={1291}
            height={708}
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 hidden h-auto w-32 select-none sm:block sm:w-48 lg:w-64"
            priority
          />

          <h1 className="text-4xl font-semibold tracking-tight text-night-sky">
            {getGreeting(now)}, {userFirstName}.
          </h1>

          <p className="mt-3 text-2xl font-light italic text-night-sky/60">
            {formatLongDate(now)} {formatTime(now)}
          </p>
        </div>

        <div className="rounded-3xl border border-night-sky/10 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/40">
              Monthly activity
            </p>

            {streak >= 2 && (
              <div className="mt-2 inline-flex items-center rounded-full bg-sand px-4 py-2 text-sm font-semibold text-night-sky/75">
                🔥 {streak} day streak
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-night-sky/20 text-sm font-semibold text-night-sky/75 hover:bg-sand"
                aria-label="Previous month"
              >
                ‹
              </button>

              <p className="min-w-36 text-center text-lg font-semibold text-night-sky">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(calendarDate)}
              </p>

              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-night-sky/20 text-sm font-semibold text-night-sky/75 hover:bg-sand"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              onClick={goToCurrentMonth}
              className="mt-2 text-xs font-semibold text-night-sky/60 hover:text-night-sky"
            >
              Back to current month
            </button>
          </div>
        </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-night-sky/40">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <div key={`${day}-${index}`} className="pb-1 font-semibold">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarWeeks.flat().map((cell) => {
              const isSelected =
                cell.date && getDateKey(cell.date) === selectedDateKey;

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={cell.isEmpty || !cell.date}
                  onClick={() => {
                    if (cell.date) {
                      handleCalendarDateClick(cell.date);
                    }
                  }}
                  className={`group flex aspect-square items-center justify-center rounded-full border text-xs transition ${
                    cell.isEmpty
                      ? "cursor-default border-transparent bg-transparent"
                      : isSelected
                      ? "border-night-sky bg-night-sky text-white"
                      : cell.isToday
                      ? "border-night-sky bg-white text-night-sky"
                      : "border-night-sky/10 bg-white text-night-sky/75 hover:border-night-sky/30 hover:bg-sand"
                  }`}
                >
                  {cell.isEmpty ? null : (
                    <div className="relative flex h-full w-full items-center justify-center">
                      {cell.hasEntry ? (
                        <span>{cell.label}</span>
                      ) : (
                        <>
                          <span className="group-hover:hidden">
                            {cell.label}
                          </span>
                          <span className="hidden text-sm font-semibold group-hover:inline">
                            +
                          </span>
                        </>
                      )}

                      {cell.hasEntry && !isSelected && (
                        <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-night-sky" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-night-sky/10 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-night-sky">
              {formatShortMonthDay(selectedDate)}
            </p>

            <p className="mt-2 text-sm font-medium text-night-sky/60">
              {selectedEntry ? "Editing saved entry" : "New entry"}
            </p>
          </div>

          <div>
            <p className="text-3xl font-light tracking-tight text-night-sky/70">
              {selectedEntry ? formatTime(new Date(selectedEntry.created_at)) : formatTime(now)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <textarea
            data-field-variant="unstyled"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={10}
            placeholder="Write about your day, your memories, your people..."
            className="min-h-[280px] w-full resize-none border-0 bg-transparent text-[30px] leading-[1.45] text-night-sky/85 placeholder:text-night-sky/30 focus:outline-none"
          />
        </div>

        <div className="mt-6 border-t border-night-sky/10 pt-6">
          <div>
            <p className="mb-3 text-sm font-medium text-night-sky/60">
              Tag family in this entry
            </p>

            <div className="flex flex-wrap gap-2">
              {people.length === 0 ? (
                <p className="text-sm text-night-sky/60">
                  Add people on your family page to start tagging them.
                </p>
              ) : (
                people.map((person) => {
                  const isSelected = selectedPersonIds.includes(person.id);

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => togglePerson(person.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isSelected
                          ? "border-night-sky bg-night-sky text-white"
                          : "border-night-sky/20 bg-white text-night-sky/75 hover:bg-sand"
                      }`}
                    >
                      {getPersonName(person)}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <p className="mb-3 text-sm font-medium italic text-night-sky/60">
                Family tagged:
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {selectedPeople.length === 0 ? (
                  <p className="text-sm text-night-sky/40">No one tagged yet.</p>
                ) : (
                  selectedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-sand text-sm font-semibold text-night-sky/75"
                      title={getPersonName(person)}
                    >
                      {person.profilePhotoUrl ? (
                        <img
                          src={person.profilePhotoUrl}
                          alt={getPersonName(person)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          {person.first_name?.charAt(0)}
                          {person.last_name?.charAt(0)}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <p className="text-sm font-medium italic text-night-sky/60">
                  Photos attached:
                </p>

                <button
                  type="button"
                  onClick={openFilePicker}
                  className="button-secondary"
                >
                  Add photos
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <p className="mb-3 text-xs text-night-sky/45">
                Add up to {MAX_JOURNAL_ENTRY_IMAGES} photos. Large images are
                optimized before upload.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {allPhotoPreviews.length === 0 ? (
                  <p className="text-sm text-night-sky/40">No photos added yet.</p>
                ) : (
                  <>
                    {allPhotoPreviews.slice(0, 3).map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={url}
                        alt={`Journal attachment ${index + 1}`}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ))}

                    {allPhotoPreviews.length > 3 && (
                      <div className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-sand px-3 text-sm font-semibold text-night-sky/75">
                        +{allPhotoPreviews.length - 3}
                      </div>
                    )}

                    <div className="rounded-full bg-sand px-3 py-2 text-sm font-medium text-night-sky/75">
                      {allPhotoPreviews.length} photo
                      {allPhotoPreviews.length === 1 ? "" : "s"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="button-primary px-8 py-4"
            >
              {isSaving ? "Saving..." : selectedEntry ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-sand px-4 py-3 text-sm text-night-sky/75">
            {message}
          </div>
        )}
      </section>
    </div>
  );
}
