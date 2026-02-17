import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const navigate = useNavigate()

  return (
    <section>
      <h2>Login</h2>
      <p>Supabase auth will live here.</p>
      <p className="hint">For now this is a placeholder page.</p>
      <button type="button" onClick={() => navigate('/dashboard')}>
        Continue to dashboard
      </button>
    </section>
  )
}

export default LoginPage
