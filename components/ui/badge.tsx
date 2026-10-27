import { statuses, type Status } from "@/lib/scenarios";
export default function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <span aria-hidden="true" />
      {statuses[status]}
    </span>
  );
}
