import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type BookingResult, type PublicSlot } from './api';
import { dayLabel, groupByDay, timeLabel } from './format';

export default function GuestPage() {
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PublicSlot | null>(null);
  const [booked, setBooked] = useState<BookingResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSlots = async () => {
    try {
      setSlots(await api.listSlots());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots(); // load once when the page opens
  }, []);

  // Success screen replaces the list after booking
  if (booked) {
    return (
      <section className="card success">
        <p className="eyebrow">Booked</p>
        <h2>See you {dayLabel(booked.startsAt)} at {timeLabel(booked.startsAt)}</h2>
        <p className="message">
          {booked.confirmationMessage ?? `You're all set, ${booked.name}! ☕`}
        </p>
        <button className="ghost" onClick={() => { setBooked(null); setSelected(null); loadSlots(); }}>
          Back to times
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="intro">
        <h1>Grab a coffee with me</h1>
        <p>Pick a free time, tell me what you'd like to talk about, and it's in the calendar.</p>
      </section>

      {notice && <p className="alert">{notice}</p>}
      {error && <p className="alert">{error}</p>}
      {loading && <p className="muted">Loading times…</p>}
      {!loading && !error && slots.length === 0 && (
        <p className="muted">No open times right now. Check back soon.</p>
      )}

      {groupByDay(slots).map(([day, daySlots]) => (
        <section key={day} className="day">
          <h3>{day}</h3>
          <div className="slot-grid">
            {daySlots.map((slot) => (
              <button
                key={slot.id}
                className={`slot ${slot.id === selected?.id ? 'selected' : ''}`}
                disabled={slot.isBooked} // booked slots are visible but not clickable
                onClick={() => { setSelected(slot); setNotice(null); }}
              >
                <span className="time">{timeLabel(slot.startsAt)}</span>
                <span className="meta">{slot.isBooked ? 'taken' : `${slot.durationMinutes} min`}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {selected && (
        <BookingForm
          slot={selected}
          onCancel={() => setSelected(null)}
          onBooked={setBooked}
          onConflict={() => {
            // Someone else was faster: explain, close the form, refresh the list
            setNotice('Someone just booked that time. Please pick another one.');
            setSelected(null);
            loadSlots();
          }}
        />
      )}
    </>
  );
}

interface FormProps {
  slot: PublicSlot;
  onCancel: () => void;
  onBooked: (b: BookingResult) => void;
  onConflict: () => void;
}

function BookingForm({ slot, onCancel, onBooked, onConflict }: FormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); // stop the browser from reloading the page
    setSubmitting(true); // disables the button, so a double click can't send twice
    setError(null);
    try {
      onBooked(await api.book(slot.id, { name, email, note: note || undefined }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onConflict(); // slot was taken in the meantime
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <p className="eyebrow">Booking</p>
      <h2>{dayLabel(slot.startsAt)}, {timeLabel(slot.startsAt)}</h2>

      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
      </label>
      <label>
        <span>What would you like to chat about? <span className="muted">(optional)</span></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} />
      </label>

      {error && <p className="alert">{error}</p>}

      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={submitting}>{submitting ? 'Booking…' : 'Book this time'}</button>
      </div>
    </form>
  );
}
