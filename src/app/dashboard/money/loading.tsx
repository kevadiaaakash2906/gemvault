import { ListPageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <ListPageSkeleton cards={2} rows={5} columns={5} />;
}
