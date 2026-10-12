import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton, type DashboardArea } from "@/components/dashboard/dashboard-card";

const AREAS: readonly DashboardArea[] = ["continue", "mission", "korume", "journey", "weakness", "weekly", "activity", "achievements", "quick"];

export default function DashboardLoading() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-layout" aria-busy="true">
        <div className="dashboard-header"><div><Skeleton className="h-4 w-32" /><Skeleton className="mt-sm h-9 w-64" /></div></div>
        <div className="dashboard-grid">
          <div className="dashboard-row dashboard-row--lead">{AREAS.slice(0, 2).map((area) => <CardSkeleton key={area} area={area} />)}</div>
          <div className="dashboard-row dashboard-row--three">{AREAS.slice(2, 5).map((area) => <CardSkeleton key={area} area={area} />)}</div>
          <div className="dashboard-row dashboard-row--trend">{AREAS.slice(5, 7).map((area) => <CardSkeleton key={area} area={area} />)}</div>
          <div className="dashboard-row">{AREAS.slice(7, 8).map((area) => <CardSkeleton key={area} area={area} />)}</div>
          <div className="dashboard-row">{AREAS.slice(8).map((area) => <CardSkeleton key={area} area={area} />)}</div>
        </div>
      </div>
    </div>
  );
}
