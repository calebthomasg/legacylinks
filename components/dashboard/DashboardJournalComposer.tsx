"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  profilePhotoUrl: string | null;
};

type DashboardJournalComposerProps = {
  userFirstName: string;
  people: PersonOption[];
  entryDates: string[];
};

function getPersonName(person: PersonOption) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
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

function buildCalendar(currentDate: Date, entryDates: string[]) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const firstWeekday = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const entryDateSet = new Set(
    entryDates.map((dateString) => {
      const date = new Date(dateString);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })
  );

  const todayKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;

  const cells: {
    key: string;
    label: number | null;
    hasEntry: boolean;
    isToday: boolean;
    isEmpty: boolean;
  }[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      key: `empty-start-${i}`,
      label: null,
      hasEntry: false,
      isToday: false,
      isEmpty: true,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${year}-${month}-${day}`;

    cells.push({
      key,
      label: day,
      hasEntry: entryDateSet.has(key),
      isToday: key === todayKey,
      isEmpty: false,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `empty-end-${cells.length}`,
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

function calculateStreak(entryDates: string[]) {
  const loggedDateKeys = new Set(
    entryDates.map((dateString) => {
      const date = new Date(dateString);

      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })
  );

  const today = new Date();
  let cursor = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  let streak = 0;

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;

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
  entryDates,
}: DashboardJournalComposerProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [now, setNow] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [body, setBody] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const nextPreviewUrls = selectedFiles.map((file) =>
      URL.createObjectURL(file)
    );

    setPreviewUrls(nextPreviewUrls);

    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const calendarWeeks = useMemo(
  () => buildCalendar(calendarDate, entryDates),
  [calendarDate, entryDates]
);
  const streak = useMemo(() => calculateStreak(entryDates), [entryDates]);

  const selectedPeople = people.filter((person) =>
    selectedPersonIds.includes(person.id)
  );

  function togglePerson(personId: string) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

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
  setCalendarDate(new Date());
}

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleSave() {
    if (!body.trim() && selectedFiles.length === 0) {
      setMessage("Write something or add a photo before saving.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to save an entry.");
      setIsSaving(false);
      return;
    }

    const entryTitle = `${formatLongDate(now)} Journal Entry`;

    const { data: newEntry, error: entryError } = await supabase
      .from("journal_entries")
      .insert({
        user_id: user.id,
        title: entryTitle,
        body: body.trim(),
      })
      .select("id")
      .single();

    if (entryError || !newEntry) {
      setMessage(entryError?.message ?? "Could not save journal entry.");
      setIsSaving(false);
      return;
    }

    if (selectedPersonIds.length > 0) {
      const tagRows = selectedPersonIds.map((personId) => ({
        journal_entry_id: newEntry.id,
        person_id: personId,
        tagged_by_user_id: user.id,
      }));

      const { error: tagError } = await supabase
        .from("journal_entry_people")
        .insert(tagRows);

      if (tagError) {
        setMessage(tagError.message);
        setIsSaving(false);
        return;
      }
    }

    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const safeName = file.name.replace(/\s+/g, "-");
        const storagePath = `${user.id}/${newEntry.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("journal-images")
          .upload(storagePath, file);

        if (uploadError) {
          setMessage(uploadError.message);
          setIsSaving(false);
          return;
        }

        const { error: imageRowError } = await supabase
          .from("journal_entry_images")
          .insert({
            journal_entry_id: newEntry.id,
            user_id: user.id,
            storage_path: storagePath,
            file_name: file.name,
          });

        if (imageRowError) {
          setMessage(imageRowError.message);
          setIsSaving(false);
          return;
        }
      }
    }

    setBody("");
    setSelectedPersonIds([]);
    setSelectedFiles([]);
    setMessage("Journal entry saved.");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-gray-950">
            {getGreeting(now)}, {userFirstName}.
          </h1>

          <p className="mt-3 text-2xl font-light italic text-gray-500">
            {formatLongDate(now)} {formatTime(now)}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
  <div>
    <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
      Monthly activity
    </p>

    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        onClick={goToPreviousMonth}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        aria-label="Previous month"
      >
        ‹
      </button>

      <p className="min-w-36 text-center text-lg font-semibold text-gray-900">
        {new Intl.DateTimeFormat("en-US", {
          month: "long",
          year: "numeric",
        }).format(calendarDate)}
      </p>

      <button
        type="button"
        onClick={goToNextMonth}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        aria-label="Next month"
      >
        ›
      </button>
    </div>

    <button
      type="button"
      onClick={goToCurrentMonth}
      className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-900"
    >
      Back to current month
    </button>
  </div>

{streak >= 2 && (
  <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
    🔥 {streak} day streak
  </div>
)}
</div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
  <div key={`${day}-${index}`} className="pb-1 font-semibold">
    {day}
  </div>
))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarWeeks.flat().map((cell) => (
              <div
                key={cell.key}
                className={`flex aspect-square items-center justify-center rounded-full border text-xs ${
                  cell.isEmpty
                    ? "border-transparent bg-transparent"
                    : cell.isToday
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {cell.isEmpty ? null : (
                  <div className="relative flex h-full w-full items-center justify-center">
                    <span>{cell.label}</span>

                    {cell.hasEntry && !cell.isToday && (
                      <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-gray-900" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-4xl font-semibold tracking-tight text-gray-950">
              {formatShortMonthDay(now)}
            </p>
          </div>

          <div>
            <p className="text-3xl font-light tracking-tight text-gray-600">
              {formatTime(now)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={10}
            placeholder="Write about your day, your memories, your people..."
            className="min-h-[280px] w-full resize-none border-0 bg-transparent text-[30px] leading-[1.45] text-gray-800 placeholder:text-gray-300 focus:outline-none"
          />
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <div>
            <p className="mb-3 text-sm font-medium text-gray-500">
              Tag family in this entry
            </p>

            <div className="flex flex-wrap gap-2">
              {people.length === 0 ? (
                <p className="text-sm text-gray-500">
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
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
              <p className="mb-3 text-sm font-medium italic text-gray-500">
                Family tagged:
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {selectedPeople.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No one tagged yet.
                  </p>
                ) : (
                  selectedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold text-gray-700"
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
                <p className="text-sm font-medium italic text-gray-500">
                  Photos attached:
                </p>

                <button
                  type="button"
                  onClick={openFilePicker}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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

              <div className="flex flex-wrap items-center gap-3">
                {previewUrls.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No photos added yet.
                  </p>
                ) : (
                  <>
                    {previewUrls.slice(0, 3).map((url, index) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Selected upload ${index + 1}`}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ))}

                    {previewUrls.length > 3 && (
                      <div className="flex h-16 min-w-16 items-center justify-center rounded-2xl bg-gray-100 px-3 text-sm font-semibold text-gray-700">
                        +{previewUrls.length - 3}
                      </div>
                    )}

                    <div className="rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
                      {previewUrls.length} photo
                      {previewUrls.length === 1 ? "" : "s"}
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
              className="rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
            {message}
          </div>
        )}
      </section>
    </div>
  );
}