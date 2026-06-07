export function SkeletonBlock({ className = '', style = {} }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />
}

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
