import { ListPageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <ListPageSkeleton cards={6} rows={9} columns={9} />;
}
