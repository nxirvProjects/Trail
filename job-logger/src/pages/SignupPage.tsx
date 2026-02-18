import { type SubmitEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        navigate('/dashboard', { replace: true })
      }
    })()
  }, [navigate])

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (data.session) {
      navigate('/dashboard', { replace: true })
      return
    }

    setStatusMessage('Account created. Check your email to verify your account before logging in.')
  }

  return (
    <section className="auth-card">
      <h2>Sign up</h2>
      <p>Create your account with email (username) and password.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email (username)
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
        {statusMessage ? <p className="success-message">{statusMessage}</p> : null}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="hint">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}

export default SignupPage
