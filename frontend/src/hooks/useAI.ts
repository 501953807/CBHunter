import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSuggestions, markRead, markApplied, dismissSuggestion, runAnalysis } from '../api/ai'
import { useToast } from '../components/ui/Toast'

export function useSuggestions(severity?: string) {
  return useQuery({
    queryKey: ['ai-suggestions', severity],
    queryFn: () => getSuggestions(severity),
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useMarkApplied() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: markApplied,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      toast.addToast('success', '建议已记录为采纳；未自动执行经营动作')
    },
  })
}

export function useDismissSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dismissSuggestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useRunAnalysis() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: runAnalysis,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      toast.addToast(result.status === 'data_required' ? 'warning' : 'success', result.status === 'data_required' ? '分析完成，但未生成新建议' : 'AI 分析完成')
    },
    onError: () => toast.addToast('error', 'AI 分析失败'),
  })
}
