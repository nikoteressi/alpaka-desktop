import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageBubble from './MessageBubble.vue'
import { createPinia, setActivePinia } from 'pinia'

describe('MessageBubble.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders user message correctly', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          role: 'user',
          content: 'Hello from user',
        }
      }
    })

    expect(wrapper.text()).toContain('Hello from user')
    expect(wrapper.find('.bg-blue-600').exists()).toBe(true)
  })

  it('renders assistant thinking block and CSS classes when isThinking is true', async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          role: 'assistant',
          content: 'Final answer',
        },
        isThinking: true,
        thinkingContent: 'Thought process here...'
      }
    })

    expect(wrapper.text()).toContain('Executing Thought Process...')
    expect(wrapper.text()).toContain('Thought process here...')
    const thinkingBox = wrapper.find('.animate-think-pulse')
    expect(thinkingBox.exists()).toBe(true)
  })

  it('markdown throttling logic renders content correctly', async () => {
    // We don't spy on RAF directly because useRafFn is an abstraction.
    // Instead we wait for the reactive state to update.
    
    const wrapper = mount(MessageBubble, {
      props: {
        message: {
          role: 'assistant',
          content: '**Bolded Content**',
        },
        isStreaming: false // Not streaming should render immediately
      }
    })

    await wrapper.vm.$nextTick()
    
    // Check if the html updated
    const htmlDiv = wrapper.find('.rendered-markdown')
    expect(htmlDiv.html()).toContain('<strong>Bolded Content</strong>')
  })
})
