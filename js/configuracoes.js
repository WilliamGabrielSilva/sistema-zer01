/* As configurações da loja ficam no frontend apenas até existir uma tabela própria no schema. Credenciais nunca são salvas aqui. */
document.getElementById('store-settings')?.addEventListener('submit',e=>{e.preventDefault();toast('As credenciais do banco devem ser alteradas somente em js/supabase.js.','error')});
