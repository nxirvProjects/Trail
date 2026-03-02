import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface ScrapedJob {
  company_name: string;
  role_title: string;
  url: string;
}

export function Popup() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [scrapedJob, setScrapedJob] = useState<ScrapedJob | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Try to scrape the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_JOB' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.data) {
          setScrapedJob(response.data);
          setCompanyName(response.data.company_name);
          setRoleTitle(response.data.role_title);
        }
      });
    });
  }, [user]);

  const handleLogin = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    }
  };

  const handleLogJob = async () => {
    if (!user || !roleTitle || !companyName) return;
    setSaving(true);

    const { error } = await supabase.from('jobs').insert({
      user_id: user.id,
      company_name: companyName,
      role_title: roleTitle,
      url: scrapedJob?.url ?? '',
      status: 'applied',
      date_applied: new Date().toISOString().split('T')[0],
      position: 0,
      notes: '',
    });

    if (!error) {
      setSaved(true);
      chrome.runtime.sendMessage({ type: 'JOB_LOGGED' });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return <div style={styles.container}><p style={styles.text}>Loading...</p></div>;
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>JobLogger</h1>
        <p style={styles.subtitle}>Sign in to log jobs</p>
        {authError && <p style={styles.error}>{authError}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button onClick={handleLogin} style={styles.button}>Sign In</button>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={styles.container}>
        <div style={styles.successIcon}>&#10003;</div>
        <h2 style={styles.successTitle}>Job Logged!</h2>
        <p style={styles.text}>{roleTitle} at {companyName}</p>
        <button onClick={() => setSaved(false)} style={{ ...styles.button, marginTop: 16, background: '#6B7280' }}>
          Log Another
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>JobLogger</h1>
        <button onClick={handleSignOut} style={styles.signOutBtn}>Sign out</button>
      </div>
      <div style={styles.form}>
        <label style={styles.label}>Role Title</label>
        <input
          type="text"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          style={styles.input}
          placeholder="Software Engineer"
        />
        <label style={styles.label}>Company</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          style={styles.input}
          placeholder="Acme Inc."
        />
        {scrapedJob ? (
          <p style={styles.hint}>Auto-extracted from page</p>
        ) : (
          <p style={styles.hint}>Navigate to a job posting for auto-extraction</p>
        )}
        <button
          onClick={handleLogJob}
          disabled={saving || !roleTitle || !companyName}
          style={{
            ...styles.button,
            opacity: saving || !roleTitle || !companyName ? 0.5 : 1,
          }}
        >
          {saving ? 'Logging...' : 'Log Job'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4F46E5',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '10px 16px',
    background: '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  signOutBtn: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontSize: 12,
    cursor: 'pointer',
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#DC2626',
    background: '#FEF2F2',
    padding: '8px 12px',
    borderRadius: 8,
    width: '100%',
    textAlign: 'center' as const,
  },
  text: {
    fontSize: 13,
    color: '#6B7280',
  },
  successIcon: {
    fontSize: 40,
    color: '#10B981',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
  },
};
