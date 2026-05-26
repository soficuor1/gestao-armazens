# Gestão de Armazéns

Aplicação web para gerir armazéns, produtos, stock e movimentos. Os dados ficam guardados no browser (localStorage), sem servidor nem base de dados externa.

**Repositório:** [github.com/soficuor1/gestao-armazens](https://github.com/soficuor1/gestao-armazens)

## Funcionalidades

- **Painel** — resumo (armazéns, produtos, stock, alertas) e últimos movimentos
- **Armazéns** — criar, editar e remover locais (remoção bloqueada se houver stock)
- **Produtos** — SKU, nome, unidade e quantidade mínima para alertas de reposição
- **Stock** — matriz armazém × produto
- **Movimentos** — entradas, saídas, ajustes de inventário e transferências entre armazéns
- **Dados de exemplo** — botão na barra lateral para carregar um cenário pré-preenchido

## Tecnologias

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) 8

## Requisitos

- [Node.js](https://nodejs.org/) 18 ou superior (recomendado: versão LTS)
- npm (incluído com o Node.js)

## Instalação e execução

```bash
git clone https://github.com/soficuor1/gestao-armazens.git
cd gestao-armazens
npm install
npm run dev
```

Abrir no browser o endereço indicado no terminal (normalmente `http://localhost:5173`). Se a porta estiver ocupada, o Vite pode usar outra (por exemplo `5174`).

## Outros comandos

| Comando           | Descrição                          |
| ----------------- | ---------------------------------- |
| `npm run build`   | Compila o projeto para produção    |
| `npm run preview` | Pré-visualiza a build de produção  |

A pasta `dist/` é gerada pelo build e não deve ser enviada manualmente para o Git (está no `.gitignore`).

## Estrutura do projeto

```
src/
  main.tsx      # Entrada da aplicação
  App.tsx       # Interface e vistas
  store.tsx     # Estado global e localStorage
  types.ts      # Tipos TypeScript
  app.css       # Estilos
public/
  favicon.svg
index.html
```

## Notas

- Os dados persistem apenas no **localStorage** do browser onde a app é usada.
- **Limpar dados** (barra lateral) repõe a aplicação ao estado vazio.
- Para testar rapidamente, usar **Carregar exemplo** na barra lateral.


