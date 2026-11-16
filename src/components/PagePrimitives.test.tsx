import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PageDirectory } from './PagePrimitives'
import userEvent from '@testing-library/user-event'
import AboutPage from './AboutPage'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('reveals an off-screen selected category without scrolling the page', () => {
  const entries = [{ id: 'first', label: 'First', icon: 'about', group: 0 }, { id: 'last', label: 'Last', icon: 'settings', group: 0 }] as const
  const props = { title: 'Settings', base: '/settings', entries }
  const view = render(<PageDirectory {...props} selected="first"/>)
  const nav = screen.getByRole('navigation')
  Object.defineProperties(nav, { clientWidth: { value: 200 }, scrollWidth: { value: 400 } })
  vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ left: 20, right: 220 } as DOMRect)
  vi.spyOn(screen.getByRole('link', { name: 'Last' }), 'getBoundingClientRect').mockReturnValue({ left: 270, right: 370 } as DOMRect)
  const scroll = vi.spyOn(window, 'scrollTo')
  view.rerender(<PageDirectory {...props} selected="last"/>)
  expect(nav.scrollLeft).toBe(150)
  expect(scroll).not.toHaveBeenCalled()
})

it('opens About sections from the compact picker and restores deep links through history', async () => {
  history.replaceState(null, '', '/about/privacy')
  const user = userEvent.setup()
  render(<AboutPage/>)
  const picker = screen.getByRole('combobox', { name: 'About section' })
  expect(picker).toHaveValue('privacy')
  expect(screen.getByRole('article', { name: 'Privacy policy' })).toBeVisible()
  await user.selectOptions(picker, 'credits')
  expect(location.pathname).toBe('/about/credits')
  expect(screen.getByRole('article', { name: 'Thanks & licenses' })).toBeVisible()
  history.back()
  await waitFor(() => expect(picker).toHaveValue('privacy'))
  expect(screen.getByRole('article', { name: 'Privacy policy' })).toBeVisible()
})

it('returns the About overview to its canonical address and focuses the new section heading',async()=>{
  history.replaceState(null,'','/about/community')
  const user=userEvent.setup()
  render(<AboutPage/>)
  const navigation=screen.getByRole('navigation',{name:'About categories'})
  await user.click(within(navigation).getByRole('link',{name:'What’s mewvi?'}))
  expect(location.pathname).toBe('/about')
  expect(screen.getByRole('heading',{name:'Meet mewvi.',level:2})).toHaveFocus()
  const workspaces=screen.getByRole('navigation',{name:'Choose a workspace'})
  expect(within(workspaces).getByRole('link',{name:/Download media/})).toHaveAttribute('href','/')
  expect(within(workspaces).getByRole('link',{name:/Convert your files/})).toHaveAttribute('href','/local')
  expect(within(workspaces).getByRole('link',{name:/Collect with Tools/})).toHaveAttribute('href','/tools')
  expect(workspaces.querySelector('a button')).toBeNull()
})

it('keeps heading permalinks while preserving the About document hierarchy',async()=>{
  history.replaceState(null,'','/about/privacy#local-files')
  Element.prototype.scrollIntoView=vi.fn()
  render(<AboutPage/>)
  const article=screen.getByRole('article',{name:'Privacy policy'})
  expect(await within(article).findByRole('heading',{name:'What stays here. What goes online.',level:2})).toHaveAttribute('id','what-stays-here-what-goes-online')
  expect(within(article).getByRole('heading',{name:'Local files',level:3})).toBeVisible()
  expect(document.getElementById('local-files')).not.toBeNull()
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block:'start',behavior:'instant'})
})
