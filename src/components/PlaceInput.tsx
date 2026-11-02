import { useEffect, useRef, useState } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { searchPlaces, type Place } from '@/lib/places';

interface PlaceInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggested place is picked, so the country can follow it. */
  onPlacePicked?: (place: Place) => void;
  placeholder?: string;
  variant?: 'chip' | 'field';
  required?: boolean;
  className?: string;
  /** Ranked suggestions to show ahead of the looked-up places (e.g. where listings are). */
  extraSuggestions?: { label: string; hint?: string }[];
}

/** "Town or city" field: suggests real places as you type; free text still works. */
export function PlaceInput({
  id,
  value,
  onChange,
  onPlacePicked,
  placeholder,
  variant = 'field',
  required = true,
  className,
  extraSuggestions = [],
}: PlaceInputProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const picked = useRef<string | null>(null);

  useEffect(() => {
    // Just chose a suggestion — no need to search for the label we filled in.
    if (picked.current === value) return;
    if (value.trim().length < 2) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(value, controller.signal).then((found) => {
        if (controller.signal.aborted) return;
        setPlaces(found);
        setLoading(false);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [value]);

  return (
    <SearchBox
      id={id}
      required={required}
      variant={variant}
      className={className}
      icon="place"
      label="Town or city"
      value={value}
      loading={loading}
      placeholder={placeholder ?? 'Town or city'}
      suggestions={[
        ...extraSuggestions,
        ...places
          .filter((p) => !extraSuggestions.some((e) => e.label === p.label))
          .map((p) => ({ label: p.label, hint: p.country })),
      ].slice(0, 8)}
      onChange={(next) => {
        const place = places.find((p) => p.label === next);
        if (place) {
          picked.current = next;
          onPlacePicked?.(place);
        } else {
          picked.current = null;
        }
        onChange(next);
      }}
    />
  );
}
