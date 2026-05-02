<template>
  <div class="my-10 rounded-xl border border-[var(--vp-c-border)] bg-[#18181a] shadow-2xl overflow-hidden flex flex-col font-sans select-none text-[13px]" style="height: 500px;">
    
    <div class="flex-1 flex overflow-hidden">
      <!-- Far Left Icon Strip -->
      <div class="w-12 bg-[#18181a] border-r border-[#262628] flex flex-col items-center py-3">
        <div class="w-8 h-8 rounded-md hover:bg-white/5 flex items-center justify-center cursor-pointer text-[#a1a1aa] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </div>
      </div>
      
      <!-- Sidebar -->
      <div class="w-60 bg-[#1e1e20] border-r border-[#262628] flex flex-col relative text-[#d4d4d8]">
        <!-- New Chat Button -->
        <div class="p-4 pb-2">
          <div class="h-10 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] flex items-center px-4 font-medium cursor-pointer transition-colors border border-[#3f3f46]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mr-3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Chat
          </div>
        </div>
        
        <!-- Main Nav -->
        <div class="flex flex-col gap-0.5 px-2 py-2">
          <div class="h-9 rounded-md flex items-center px-3 hover:bg-white/5 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mr-3 text-[#a1a1aa]"><path d="M13.5 2.5l5.5 5.5-12.5 12.5-5.5-5.5 12.5-12.5z"></path><path d="M2.5 21.5l5.5-5.5"></path></svg>
            Launch
          </div>
          <div class="h-9 rounded-md flex items-center px-3 hover:bg-white/5 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mr-3 text-[#a1a1aa]"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            Models
          </div>
          <div class="h-9 rounded-md flex items-center px-3 hover:bg-white/5 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mr-3 text-[#a1a1aa]"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </div>
        </div>
        
        <!-- Conversations List -->
        <div class="px-5 pt-4 pb-1 flex justify-between items-center text-[10px] font-bold text-[#71717a] uppercase tracking-wider">
          <span>Conversations</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        
        <div class="px-5 pt-2 text-[10px] font-bold text-[#71717a] uppercase tracking-wider border-b border-[#262628] pb-2 mb-1">
          Today
        </div>
        
        <div class="flex flex-col gap-0.5 px-2">
          <div class="h-8 rounded flex items-center px-3 text-[#a1a1aa] hover:bg-white/5 cursor-pointer truncate">test</div>
          <div class="h-8 rounded flex items-center px-3 text-[#a1a1aa] hover:bg-white/5 cursor-pointer truncate">hello</div>
          <div class="h-8 rounded flex items-center px-3 text-[#a1a1aa] hover:bg-white/5 cursor-pointer truncate">Explain quantum comput...</div>
        </div>
        
        <!-- Interactive Overlay Labels -->
        <div class="absolute top-4 -right-16 text-[10px] bg-[var(--vp-c-brand-1)] text-white px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">Sidebar</div>
      </div>
      
      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col bg-[#18181a] relative group">
        
        <!-- Empty State / Center Icon -->
        <div class="flex-1 flex items-center justify-center pointer-events-none">
          <div class="text-6xl drop-shadow-lg opacity-90">🦙</div>
        </div>
        
        <!-- Input Area -->
        <div class="p-6 relative">
          <!-- Main Input Bubble -->
          <div class="min-h-[80px] rounded-[24px] bg-[#27272a] border border-[#3f3f46] flex flex-col p-3 shadow-md focus-within:border-[#52525b] transition-colors relative">
            <div class="text-[#71717a] px-3 pt-1 text-[14px]">Type a message...</div>
            
            <div class="flex items-center justify-end gap-2 mt-auto pt-2">
              <div class="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </div>
              <div class="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              <div class="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <div class="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] cursor-pointer mr-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              </div>
              
              <!-- Model Selector -->
              <div class="h-7 rounded-full bg-[#18181a] border border-[#3f3f46] flex items-center px-3 text-[12px] font-medium text-[#d4d4d8] cursor-pointer hover:border-[#52525b] transition-colors">
                qwen3-vl:4b <span class="ml-1 text-[10px] text-[#71717a]">▼</span>
              </div>
              
              <!-- Send Button -->
              <div class="w-7 h-7 rounded-full bg-[#3f3f46] text-[#71717a] flex items-center justify-center cursor-not-allowed ml-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              </div>
            </div>
          </div>
          
          <div class="absolute -top-1 right-8 text-[10px] bg-[var(--vp-c-brand-1)] text-white px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">Message Input</div>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Interactive UI mockup component matching the actual Alpaka Desktop application.
</script>
