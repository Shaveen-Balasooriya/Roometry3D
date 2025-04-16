import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { db } from './firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

function App() {
  const [count, setCount] = useState(0)
  const [firestoreMsg, setFirestoreMsg] = useState('')

  const testFirestore = async () => {
    try {
      const testRef = doc(db, 'testCollection', 'testDoc')
      await setDoc(testRef, { hello: 'world' })
      const snap = await getDoc(testRef)
      setFirestoreMsg('Firestore test success: ' + JSON.stringify(snap.data()))
    } catch (e) {
      setFirestoreMsg('Firestore error: ' + e.message)
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={testFirestore}>Test Firestore</button>
        {firestoreMsg && <p>{firestoreMsg}</p>}
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
