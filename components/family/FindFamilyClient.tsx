"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ExistingPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  linked_user_id: string | null;
};

type ProfileSearchResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type IncomingRequest = {
  id: string;
  requester_user_id: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  relationship_type: string;
  nickname: string | null;
  message: string | null;
  created_at: string;
};

type Props = {
  currentUserId: string;
  currentUserPersonId: string | null;
  existingPeople: ExistingPerson[];
  incomingRequests: IncomingRequest[];
};

const relationshipOptions = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "child", label: "Child" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "grandfather", label: "Grandfather" },
  { value: "grandmother", label: "Grandmother" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other", label: "Other" },
];

function getDisplayName(profile: ProfileSearchResult) {
  return (
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    "Unnamed user"
  );
}

function getPersonDisplayName(person: ExistingPerson) {
  return (
    person.display_name ||
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
    "Unnamed person"
  );
}

function getRequesterName(request: IncomingRequest) {
  return (
    `${request.requester_first_name ?? ""} ${
      request.requester_last_name ?? ""
    }`.trim() || "Someone"
  );
}

function formatRelationship(value: string) {
  const match = relationshipOptions.find((option) => option.value === value);
  return match?.label ?? value;
}

export default function FindFamilyClient({
  currentUserId,
  currentUserPersonId,
  existingPeople,
  incomingRequests,
}: Props) {
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedProfile, setSelectedProfile] =
    useState<ProfileSearchResult | null>(null);

  const [relationshipType, setRelationshipType] = useState("mother");
  const [nickname, setNickname] = useState("");
  const [existingRelatedPersonId, setExistingRelatedPersonId] = useState("");
  const [message, setMessage] = useState("");

  const [requests, setRequests] = useState<IncomingRequest[]>(incomingRequests);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const availableExistingPeople = useMemo(() => {
    return existingPeople.filter((person) => !person.linked_user_id);
  }, [existingPeople]);

  async function handleSearch(value: string) {
    setQuery(value);
    setStatusMessage("");

    const trimmedValue = value.trim();

    if (trimmedValue.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const { data, error } = await supabase.rpc("search_profiles", {
      search_text: trimmedValue,
    });

    if (error) {
      console.error(error);
      setStatusMessage("Something went wrong while searching.");
      setResults([]);
      setIsSearching(false);
      return;
    }

    setResults(data ?? []);
    setIsSearching(false);
  }

  async function sendConnectionRequest() {
    if (!selectedProfile) {
      setStatusMessage("Choose a person to connect with first.");
      return;
    }

    if (!currentUserPersonId) {
      setStatusMessage(
        "Your account does not have a person profile yet. Go to your family page and make sure your own profile exists in the tree."
      );
      return;
    }

    setIsSending(true);
    setStatusMessage("");

    const { error } = await supabase.from("family_connection_requests").insert({
      requester_user_id: currentUserId,
      recipient_user_id: selectedProfile.id,
      requester_person_id: currentUserPersonId,
      existing_related_person_id: existingRelatedPersonId || null,
      relationship_type: relationshipType,
      nickname: nickname.trim() || null,
      message: message.trim() || null,
      status: "pending",
    });

    if (error) {
      console.error(error);
      setStatusMessage("Something went wrong while sending the request.");
      setIsSending(false);
      return;
    }

    setStatusMessage("Family connection request sent.");
    setSelectedProfile(null);
    setRelationshipType("mother");
    setNickname("");
    setExistingRelatedPersonId("");
    setMessage("");
    setQuery("");
    setResults([]);
    setIsSending(false);
  }

  async function acceptRequest(requestId: string) {
    setActiveRequestId(requestId);
    setStatusMessage("");

    const { error } = await supabase.rpc("accept_family_connection_request", {
      request_id: requestId,
    });

    if (error) {
      console.error(error);
      setStatusMessage("Something went wrong while accepting the request.");
      setActiveRequestId(null);
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.filter((request) => request.id !== requestId)
    );
    setStatusMessage("Family connection accepted.");
    setActiveRequestId(null);
  }

  async function declineRequest(requestId: string) {
    setActiveRequestId(requestId);
    setStatusMessage("");

    const { error } = await supabase.rpc("decline_family_connection_request", {
      request_id: requestId,
    });

    if (error) {
      console.error(error);
      setStatusMessage("Something went wrong while declining the request.");
      setActiveRequestId(null);
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.filter((request) => request.id !== requestId)
    );
    setStatusMessage("Family connection request declined.");
    setActiveRequestId(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-night-sky/10 bg-white p-5 shadow-sm">
        <label
          htmlFor="family-search"
          className="text-sm font-semibold text-night-sky"
        >
          Search for a LegacyLinks user
        </label>

        <div className="relative mt-2">
          <input
            id="family-search"
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search by first or last name"
            className="w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
          />

          {(results.length > 0 || isSearching) && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-night-sky/10 bg-white shadow-lg">
              {isSearching ? (
                <div className="px-4 py-3 text-sm text-night-sky/60">
                  Searching...
                </div>
              ) : (
                results.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfile(profile);
                      setResults([]);
                      setQuery(getDisplayName(profile));
                      setStatusMessage("");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand text-sm font-semibold text-night-sky/75">
                      {profile.first_name?.[0]}
                      {profile.last_name?.[0]}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-night-sky">
                        {getDisplayName(profile)}
                      </p>
                      <p className="text-xs text-night-sky/60">
                        LegacyLinks account
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {query.trim().length >= 2 &&
          !isSearching &&
          results.length === 0 &&
          !selectedProfile && (
            <p className="mt-3 text-sm text-night-sky/60">
              No matching profiles found.
            </p>
          )}

        {selectedProfile && (
          <div className="mt-6 rounded-2xl border border-night-sky/10 bg-sand p-4">
            <p className="text-sm font-semibold text-night-sky">
              Add {getDisplayName(selectedProfile)} as family
            </p>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-sm font-medium text-night-sky/75">
                  How is this person related to you?
                </label>
                <select
                  value={relationshipType}
                  onChange={(event) => setRelationshipType(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-night-sky/20 bg-white px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
                >
                  {relationshipOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-night-sky/75">
                  Personal nickname, optional
                </label>
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Mom, Dad, Nana, Uncle Mike..."
                  className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-night-sky/75">
                  Is this person already in your tree?
                </label>
                <select
                  value={existingRelatedPersonId}
                  onChange={(event) =>
                    setExistingRelatedPersonId(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-night-sky/20 bg-white px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
                >
                  <option value="">
                    No, create a new person when accepted
                  </option>

                  {availableExistingPeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      Link to {getPersonDisplayName(person)}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs leading-5 text-night-sky/60">
                  If this person is already in your tree, linking keeps existing
                  photos, journal tags, and memories attached to that person.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-night-sky/75">
                  Message, optional
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Hey, I’m trying to connect our family tree on LegacyLinks."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm leading-6 text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={sendConnectionRequest}
                  disabled={isSending}
                  className="button-primary"
                >
                  {isSending ? "Sending..." : "Send family request"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfile(null);
                    setRelationshipType("mother");
                    setNickname("");
                    setExistingRelatedPersonId("");
                    setMessage("");
                    setStatusMessage("");
                    setQuery("");
                    setResults([]);
                  }}
                  className="button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {statusMessage && (
          <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
            {statusMessage}
          </p>
        )}
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-night-sky/10 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-night-sky">
            Incoming requests
          </h2>

          {requests.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-night-sky/70">
              You do not have any pending family requests.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-night-sky/10 bg-sand p-4"
                >
                  <p className="text-sm font-semibold text-night-sky">
                    {getRequesterName(request)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-night-sky/70">
                    Wants to connect with you as their{" "}
                    <span className="font-semibold">
                      {formatRelationship(request.relationship_type)}
                    </span>
                    {request.nickname ? ` (${request.nickname})` : ""}.
                  </p>

                  {request.message && (
                    <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-night-sky/70">
                      {request.message}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => acceptRequest(request.id)}
                      disabled={activeRequestId === request.id}
                      className="button-primary px-3 py-2 text-xs"
                    >
                      {activeRequestId === request.id ? "Working..." : "Accept"}
                    </button>

                    <button
                      type="button"
                      onClick={() => declineRequest(request.id)}
                      disabled={activeRequestId === request.id}
                      className="button-secondary px-3 py-2 text-xs"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-night-sky/10 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-night-sky">
            Suggested later
          </h2>
          <p className="mt-2 text-sm leading-6 text-night-sky/70">
            Eventually, this area can suggest relatives based on shared
            ancestors, mutual family connections, FamilySearch IDs, or account
            invitations.
          </p>

          <div className="mt-5 rounded-xl bg-sand p-4">
            <p className="text-sm font-medium text-night-sky">
              People you may be related to
            </p>
            <p className="mt-2 text-xs leading-5 text-night-sky/60">
              Once more accounts are connected, LegacyLinks can recommend close
              relatives here.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
