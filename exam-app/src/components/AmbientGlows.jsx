export default function AmbientGlows({ amber = true, indigo = true, teal = false }) {
  return (
    <>
      {amber && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 560, height: 560, right: -120, top: -60,
            background: 'radial-gradient(circle, #F2A20C12 0%, transparent 70%)',
          }}
        />
      )}
      {indigo && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 420, height: 420, left: -80, bottom: 80,
            background: 'radial-gradient(circle, #6366F112 0%, transparent 70%)',
          }}
        />
      )}
      {teal && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 320, height: 320, left: '40%', top: '30%',
            background: 'radial-gradient(circle, #10B98110 0%, transparent 70%)',
          }}
        />
      )}
    </>
  )
}
