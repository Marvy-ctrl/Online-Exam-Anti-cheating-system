import React from 'react'
import SignupForm from '@/src/components/auth/signup'

export const metadata = {
  title: 'Sign Up - ExamGuard Examiner Portal',
  description: 'Apply for examiner access to manage zero-trust exams.',
}

export default function SignupPage() {
  return (
    <main>
      <SignupForm />
    </main>
  )
}
