import { AssessmentDisclaimerGate } from '@/components/AssessmentDisclaimerGate';

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AssessmentDisclaimerGate>{children}</AssessmentDisclaimerGate>;
}
