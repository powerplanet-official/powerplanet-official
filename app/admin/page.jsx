import Admin from '../../components/Admin';
export const metadata = { title: 'Store administration', robots: { index: false, follow: false } };
// The admin component checks the session before requesting private store data.
export default function Page() {
  return <Admin />;
}
