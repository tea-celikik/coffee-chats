import { useEffect, useState } from 'react';
import GuestPage from './GuestPage';
import HostPage from './HostPage';

// Tiny hash router: "#/host" shows the host page, anything else the guest page.
// Hash routing needs no server config, so it works on any static host.
const currentRoute = () => (window.location.hash === '#/host' ? 'host' : 'guest');

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange); // cleanup on unmount
  }, []);

  return (
    <div className="page">
      <header className="top">
        <a href="#/" className="logo">☕ Coffee Chats</a>
        <nav>
          <a href="#/" className={route === 'guest' ? 'active' : ''}>Book</a>
          <a href="#/host" className={route === 'host' ? 'active' : ''}>Host</a>
        </nav>
      </header>
      <main>{route === 'host' ? <HostPage /> : <GuestPage />}</main>
    </div>
  );
}
