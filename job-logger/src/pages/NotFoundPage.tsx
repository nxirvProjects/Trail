import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section>
      <h2>Page not found</h2>
      <p className="hint">The route you requested does not exist.</p>
      <Link to="/">Back to home</Link>
    </section>
  )
}

export default NotFoundPage
