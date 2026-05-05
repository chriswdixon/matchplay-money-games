import { Navigate, useParams } from "react-router-dom";

/**
 * Legacy /match/:id deep links redirect to the dashboard with ?match=ID,
 * which the home tab uses to surface the relevant match.
 */
const MatchRedirect = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/?match=${encodeURIComponent(id)}`} replace />;
};

export default MatchRedirect;
