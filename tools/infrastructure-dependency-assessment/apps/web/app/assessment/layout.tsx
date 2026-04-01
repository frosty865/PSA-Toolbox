import { AssessmentChrome } from '@/components/AssessmentChrome';

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AssessmentChrome>{children}</AssessmentChrome>;
}
