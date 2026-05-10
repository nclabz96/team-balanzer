export default function Spinner({ className = 'py-16' }: { className?: string }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className="w-8 h-8 border-4 border-green-100 border-t-green-700 rounded-full animate-spin" />
    </div>
  )
}
