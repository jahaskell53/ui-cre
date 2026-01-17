// Generate a deterministic hash from a string
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Convert HSL to hex color
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate an aurora gradient from any unique identifier (name, email, id)
export function generateAuroraGradient(identifier: string): string {
  const hash = hashString(identifier);

  // Use hash to generate two complementary hues for aurora effect
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40 + (hash % 60)) % 360; // Offset by 40-100 degrees for nice color pairs

  // Keep saturation high and lightness in a pleasant range
  const saturation1 = 70 + (hash % 20); // 70-90%
  const saturation2 = 65 + ((hash >> 8) % 25); // 65-90%
  const lightness1 = 60 + (hash % 15); // 60-75%
  const lightness2 = 55 + ((hash >> 4) % 20); // 55-75%

  const color1 = hslToHex(hue1, saturation1, lightness1);
  const color2 = hslToHex(hue2, saturation2, lightness2);

  // Vary the gradient angle slightly based on hash
  const angle = 120 + (hash % 40); // 120-160 degrees

  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}

export function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || "??";
}

// Toggle star handler - needs to be used with context
export function createToggleStarHandler(
  people: any[],
  setPeople: (people: any[]) => void,
  selectedPerson: any,
  setSelectedPerson: (person: any) => void,
  showStarredOnly: boolean
) {
  return async (person: any, e: React.MouseEvent) => {
    e.stopPropagation();

    const newStarredState = !person.starred;
    const optimisticPerson = { ...person, starred: newStarredState };
    setPeople(people.map((p) => (p.id === person.id ? optimisticPerson : p)));

    if (selectedPerson?.id === person.id) {
      if (showStarredOnly && !newStarredState) {
        const starredPeople = people.filter((p) => p.starred && p.id !== person.id);
        setSelectedPerson(starredPeople.length > 0 ? starredPeople[0] : null);
      } else {
        setSelectedPerson(optimisticPerson);
      }
    }

    try {
      const response = await fetch(`/api/people?id=${person.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: newStarredState }),
      });

      if (!response.ok) {
        throw new Error("Failed to update star status");
      }

      const updatedPerson = await response.json();
      setPeople(people.map((p) => (p.id === person.id ? updatedPerson : p)));

      if (selectedPerson?.id === person.id) {
        if (showStarredOnly && !updatedPerson.starred) {
          const starredPeople = people.filter((p) => p.starred && p.id !== person.id);
          setSelectedPerson(starredPeople.length > 0 ? starredPeople[0] : null);
        } else {
          setSelectedPerson(updatedPerson);
        }
      }
    } catch (error) {
      console.error("Error toggling star:", error);
      setPeople(people.map((p) => (p.id === person.id ? person : p)));
      if (selectedPerson?.id === person.id) {
        setSelectedPerson(person);
      }
    }
  };
}
