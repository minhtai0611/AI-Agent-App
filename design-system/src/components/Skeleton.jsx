/**
 * Base animated skeleton block. Pass `className` for dimensions.
 *
 * @example
 * <SkeletonBlock className="h-4 w-48" />
 */
export function SkeletonBlock({ className = '', style = {} }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />
}

/** Skeleton for the navbar auth area while auth is loading. */
export function NavbarSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <SkeletonBlock className="w-20 h-7 rounded-full" />
      <SkeletonBlock className="w-8 h-8 rounded-full" />
    </div>
  )
}

/** Full-page skeleton for the home/dashboard page. */
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-8 flex flex-col gap-6">
        <SkeletonBlock className="h-7 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-24 rounded-2xl" />)}
        </div>
        <SkeletonBlock className="h-32 rounded-2xl" />
        <SkeletonBlock className="h-14 rounded-xl" />
      </div>
    </div>
  )
}

/** Full-page skeleton for the exam selection page. */
export function ExamSelectSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-28 rounded-full" />
          <SkeletonBlock className="h-9 w-28 rounded-full" />
          <SkeletonBlock className="h-9 w-20 rounded-full" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-surface">
              <SkeletonBlock className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
              <SkeletonBlock className="h-9 w-20 rounded-xl flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for the results page. */
export function ResultsPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        </div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="p-5 rounded-2xl border border-border bg-surface flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-page skeleton for the account page. */
export function AccountPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-surface">
          <SkeletonBlock className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-28" />
          </div>
        </div>
        <div className="flex gap-2 border-b border-border pb-1">
          {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} className="h-8 w-24 rounded-lg" />)}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for the progress page. */
export function ProgressPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <SkeletonBlock className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonBlock key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for the study plan page. */
export function StudyPlanPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <SkeletonBlock className="h-6 w-48" />
        {[0, 1, 2, 3].map(i => <SkeletonBlock key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  )
}

/** Full-page skeleton for the history page. */
export function HistoryPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-3">
        <SkeletonBlock className="h-6 w-32" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface">
            <SkeletonBlock className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <SkeletonBlock className="h-4 w-3/5" />
              <SkeletonBlock className="h-3 w-2/5" />
            </div>
            <SkeletonBlock className="h-8 w-14 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-page skeleton for practice mode pages. */
export function PracticeSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <SkeletonBlock className="h-6 w-36" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    </div>
  )
}

/** Simple centered page skeleton for minimal pages. */
export function SimplePageSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-12 flex items-start justify-center">
      <div className="max-w-md w-full px-4 pt-16 flex flex-col gap-4">
        <SkeletonBlock className="h-8 w-56 mx-auto" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-11 w-full rounded-xl mt-4" />
      </div>
    </div>
  )
}

/** Skeleton for a single question card while content loads. */
export function QuestionCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <div className="flex flex-col gap-2 mt-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
            <SkeletonBlock className="w-5 h-5 rounded-full flex-shrink-0" />
            <SkeletonBlock className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the AI insights section on the results page. */
export function ResultsInsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-4/5" />
      <div className="flex flex-col gap-2 mt-2">
        <SkeletonBlock className="h-3.5 w-1/3" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-7 w-24 rounded-full" />)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3.5 w-1/4" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-3/4" />
      </div>
    </div>
  )
}
