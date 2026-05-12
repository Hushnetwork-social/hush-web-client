import { getMobileBenchmarkRouteGate } from '@/lib/crypto/mobileBenchmark';
import { MobileBenchmarkRunner } from '@/modules/mobileBenchmark';

export default function MobileBenchmarkPage() {
  return <MobileBenchmarkRunner gate={getMobileBenchmarkRouteGate()} />;
}
