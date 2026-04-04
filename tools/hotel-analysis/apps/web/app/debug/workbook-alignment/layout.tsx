import { redirect } from 'next/navigation';

/**
 * Disable this route in production: redirect to home.
 */
export default function DebugWorkbookAlignmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }
  return <>{children}</>;
}
