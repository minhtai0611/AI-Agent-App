import { Navigate } from 'react-router-dom'
import { useOrgAuth } from '../context/OrgAuthContext.jsx'

const ROLE_ORDER = ['learner', 'proctor', 'admin', 'owner']

// Client-side UX guard only — real enforcement is the server-side require_role()
// dependency in backend/app/org_auth.py. This just avoids flashing admin UI to
// someone who's about to get 401/403'd on every request.
export default function RequireOrgRole({ min = 'admin', children }) {
  const { member, status } = useOrgAuth()

  if (status === 'loading') return null
  if (status !== 'authenticated' || ROLE_ORDER.indexOf(member.role) < ROLE_ORDER.indexOf(min)) {
    return <Navigate to="/exams" replace />
  }
  return children
}
