import { useState, useRef } from 'react'

export function useVoiceInput(onResult) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'vi-VN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = e => {
      let text = e.results[0][0].transcript
      text = text
        .replace(/x bình phương/gi, 'x²')
        .replace(/y bình phương/gi, 'y²')
        .replace(/bình phương/gi, '²')
        .replace(/căn bậc hai/gi, '√')
        .replace(/căn của/gi, '√')
        .replace(/log cơ số/gi, 'log_')
        .replace(/phần trăm/gi, '%')
        .replace(/chia cho/gi, '/')
        .replace(/nhân với/gi, '×')
      onResult(text)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  return { listening, startListening, stopListening, isSupported }
}
