# Saneamento do PrintFlow CRM

## Fase 1 — Baseline e UX honesta (P0)

- [ ] Corrigir os erros atuais do lint.
- [ ] Corrigir a dependência do efeito de inicialização do `ProductEditor`.
- [ ] Remover/desabilitar claramente busca, notificações e “Novo” sem ação.
- [ ] Simplificar a busca de Google Maps desativada para não simular um formulário funcional.
- [ ] Checkpoint: lint, testes e build verdes.

## Fase 2 — Barreira contra código morto (P0)

- [ ] Limpar símbolos órfãos nos componentes do Hub.
- [ ] Limpar símbolos órfãos nas rotas.
- [ ] Limpar símbolos órfãos em produtos, orçamentos, serviços e testes.
- [ ] Ativar as verificações TypeScript/ESLint de não usados.
- [ ] Checkpoint: zero diagnóstico de não usado e pipeline verde.

## Fase 3 — Código inalcançável (P1)

- [ ] Revalidar o grafo de módulos após as fases anteriores.
- [ ] Remover wrappers de UI sem importadores.
- [ ] Remover dependências npm exclusivas dos wrappers apagados.
- [ ] Remover módulos sem consumidores que não estejam reservados para a decisão de revalidação.
- [ ] Checkpoint: build e testes verdes; lockfile revisado.

## Fase 4 — Caminhos canônicos (P1)

- [ ] Remover cliente Supabase legado.
- [ ] Remover caminho server-side inativo do motor de combinações.
- [ ] Confirmar RPCs canônicas de orçamento/pedido/produção.
- [ ] Remover serviço frontend antigo de OP se totalmente substituído.
- [ ] Checkpoint: jornada orçamento -> pedido -> pagamento/produção verificada.

## Fase 5 — Utilitários e cache (P2)

- [ ] Centralizar moeda e datas.
- [ ] Centralizar normalização duplicada.
- [ ] Centralizar status por domínio.
- [ ] Criar query keys tipadas para os domínios mais usados.
- [ ] Checkpoint: testes unitários dos utilitários e pipeline verde.

## Fase 6 — Domínio de produtos (P2)

- [ ] Criar repositório/serviço canônico de produtos.
- [ ] Criar hooks de leitura/mutação e invalidação.
- [ ] Migrar lista e editor.
- [ ] Migrar Hub e importador.
- [ ] Checkpoint: criar, editar, duplicar, arquivar e excluir verificados manualmente.

## Fase 7 — Decomposição e testes de UI (P3)

- [ ] Dividir os três maiores módulos de produtos.
- [ ] Dividir construtor de orçamento e seletor de combinações.
- [ ] Adicionar infraestrutura de testes de componente.
- [ ] Cobrir produto, orçamento -> pedido e produção.
- [ ] Checkpoint: pipeline completo e revisão de arquitetura.

## Fase 8 — Decisão de produto

- [ ] Decidir: concluir ou remover revalidação de orçamento.
- [ ] Se concluir, implementar snapshot, comparação e auditoria ponta a ponta.
- [ ] Se remover, apagar todos os artefatos órfãos associados.
- [ ] Checkpoint final: código, documentação e dependências coerentes com a decisão.

