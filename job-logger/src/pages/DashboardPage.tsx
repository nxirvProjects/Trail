import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function DashboardPage() {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login', { replace: true })
        return
      }

      setUserEmail(session.user.email ?? '')
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login', { replace: true })
        return
      }

      setUserEmail(session.user.email ?? '')
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <section>
      <h2>Dashboard</h2>
      <p>Your logged roles and follow-ups will show here.</p>
      <p className="hint">Signed in as {userEmail || 'your account'}.</p>
      <button type="button" onClick={handleSignOut}>
        Sign out
      </button>
    </section>
  )
}

export default DashboardPage
