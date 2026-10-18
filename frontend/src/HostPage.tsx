import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, hostApi, type HostSlot } from './api';
import { groupByDay, timeLabel } from './format';

const KEY_STORAGE = 'coffee-host-key';

// sessionStorage: the key is forgotten when the tab closes (safer than localStorage).
// try/catch because storage can throw in private mode or when blocked.
const loadKey = () => { try { return sessionStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; } };
const saveKey = (k: string) => { try { sessionStorage.setItem(KEY_STORAGE, k); } catch { /* ignore */ } };
const clearKey = () => { try { sessionStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ } };

export default function HostPage() {
  const [hostKey, setHostKey] = useState(loadKey);

  if (!hostKey) return <KeyGate onUnlock={(k) => { saveKey(k); setHostKey(k); }} />;
  return <Dashboard hostKey={hostKey} onLock={() => { clearKey(); setHostKey(''); }} />;
}

// --- Step 1: ask for the host key and check it against the server ---------
function KeyGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      await hostApi.list(key); // cheap request just to validate the key
      onUnlock(key);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong host key.' : (err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <p className="eyebrow">Host</p>
      <h2>Enter your host key</h2>
      <label>
        Host key
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} required autoFocus />
      </label>
      {error && <p className="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={checking}>{checking ? 'Checking…' : 'Unlock'}</button>
      </div>
    </form>
  );
}

// --- Step 2: create slots and see who booked them ---------------------------
function Dashboard({ hostKey, onLock }: { hostKey: string; onLock: () => void }) {
  const [slots, setSlots] = useState<HostSlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Any 401 means the key is no longer valid: log out instead of showing errors
  const handle = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) onLock();
    else setError((err as Error).message);
  };

  const load = async () => {
    try {
      setSlots(await hostApi.list(hostKey));
      setError(null);
    } catch (err) {
      handle(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (slot: HostSlot) => {
    const msg = slot.booking
      ? `This time is booked by ${slot.booking.name}. Delete it anyway?`
      : 'Delete this time?';
    if (!confirm(msg)) return; // ask before destructive actions
    try {
      await hostApi.remove(hostKey, slot.id);
      load();
    } catch (err) {
      handle(err);
    }
  };

  const bookedCount = slots.filter((s) => s.booking).length;

  return (
    <>
      <section className="intro row">
        <div>
          <h1>Your coffee times</h1>
          <p>{slots.length} upcoming · {bookedCount} booked</p>
        </div>
        <button className="ghost" onClick={onLock}>Lock</button>
      </section>

      <NewSlotForm hostKey={hostKey} onCreated={load} onError={handle} />

      {error && <p className="alert">{error}</p>}
      {slots.length === 0 && <p className="muted">No upcoming times yet. Add one above.</p>}

      {groupByDay(slots).map(([day, daySlots]) => (
        <section key={day} className="day">
          <h3>{day}</h3>
          <ul className="host-list">
            {daySlots.map((slot) => (
              <li key={slot.id} className={slot.booking ? 'booked' : ''}>
                <div className="when">
                  <strong>{timeLabel(slot.startsAt)}</strong>
                  <span className="muted">{slot.durationMinutes} min</span>
                </div>
                <div className="who">
                  {slot.booking ? (
                    <>
                      <strong>{slot.booking.name}</strong>{' '}
                      <a href={`mailto:${slot.booking.email}`}>{slot.booking.email}</a>
                      {slot.booking.note && <p className="note">“{slot.booking.note}”</p>}
                    </>
                  ) : (
                    <span className="muted">Open</span>
                  )}
                </div>
                <button className="ghost small" onClick={() => remove(slot)}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// Tomorrow's date as YYYY-MM-DD in local time (default for the date input)
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface NewSlotProps {
  hostKey: string;
  onCreated: () => void;
  onError: (err: unknown) => void;
}

function NewSlotForm({ hostKey, onCreated, onError }: NewSlotProps) {
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // "2026-10-20" + "10:00" is read as the host's LOCAL time, then sent as UTC
      const startsAt = new Date(`${date}T${time}`).toISOString();
      await hostApi.create(hostKey, { startsAt, durationMinutes: duration });
      onCreated();
    } catch (err) {
      // 400 (past) and 409 (overlap) are shown next to the form
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) setError(err.message);
      else onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form new-slot" onSubmit={submit}>
      <p className="eyebrow">Add a time</p>
      <div className="fields">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Start
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Length
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
      </div>
      {error && <p className="alert">{error}</p>}
    </form>
  );
}
