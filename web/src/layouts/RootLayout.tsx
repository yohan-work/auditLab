import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/Toaster'
import { Tour } from '@/components/Tour'

/** 모든 화면 공통: 알림 토스트와 둘러보기 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      <Tour />
    </>
  )
}
