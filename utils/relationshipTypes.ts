export const RELATIONSHIP_TYPES = [
  { value: "", label: "Select relationship" },

  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "parent", label: "Parent" },

  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "child", label: "Child" },

  { value: "husband", label: "Husband" },
  { value: "wife", label: "Wife" },
  { value: "spouse", label: "Spouse" },

  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "sibling", label: "Sibling" },

  { value: "grandfather", label: "Grandfather" },
  { value: "grandmother", label: "Grandmother" },
  { value: "grandparent", label: "Grandparent" },

  { value: "grandson", label: "Grandson" },
  { value: "granddaughter", label: "Granddaughter" },
  { value: "grandchild", label: "Grandchild" },

  { value: "uncle", label: "Uncle" },
  { value: "aunt", label: "Aunt" },
  { value: "nephew", label: "Nephew" },
  { value: "niece", label: "Niece" },

  { value: "cousin", label: "Cousin" },
  { value: "other_family", label: "Other family" },
];

export function getRelationshipLabel(value: string) {
  return (
    RELATIONSHIP_TYPES.find((relationship) => relationship.value === value)
      ?.label ?? value
  );
}