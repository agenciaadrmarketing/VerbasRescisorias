// ===================================================================
// COMO INSTALAR (uma vez só):
// 1. Abra a planilha (colunas: data, nome, email, whatsapp, utm_source, utm_medium, utm_campaign, pagina).
// 2. Extensões > Apps Script. Apague tudo e cole este arquivo inteiro.
// 3. Preencha abaixo EMAIL_AVISO (seu e-mail) e PLANILHA_ID (da URL da planilha, entre /d/ e /edit).
// 4. Implantar > Nova implantação > tipo "App da Web" > Executar como "Eu" > Acesso "Qualquer pessoa".
// 5. Autorize as permissões. Copie a URL do app da Web gerada.
// 6. Cole essa URL no tweak "URL da planilha (Web App)" da landing page.
// 7. Se editar o script depois, crie uma NOVA implantação (ou nova versão) para a URL valer.
// ===================================================================

var EMAIL_AVISO = 'recjohny091@gmail.com,agencia.adrmarketing@gmail.com';
var PLANILHA_ID = '19FugbxHI1V6KLw2ktMmI4bd9bLVGqfZgUvAqUAuCuxs';
var FUSO = 'America/Sao_Paulo';

var COLUNAS = ['Data', 'Nome', 'Email', 'WhatsApp', 'utm_source', 'utm_medium', 'utm_campaign', 'Pagina', 'Notificacao'];

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.nome || p.email || p.whatsapp) return salvarLead(p);
  return ContentService.createTextOutput('Thaisa Rivello - endpoint ativo');
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); }
  catch (err) { d = (e && e.parameter) ? e.parameter : {}; }
  return salvarLead(d);
}

function salvarLead(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheets()[0];

    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUNAS);
      sh.getRange(1, 1, 1, COLUNAS.length)
        .setFontWeight('bold').setBackground('#2A1015').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }

    var nome  = (d.nome || '').toString().trim();
    var email = (d.email || '').toString().trim();
    var whats = (d.whatsapp || '').toString().trim();

    // evita duplicar o mesmo contato clicando duas vezes em menos de 2 minutos
    var last = sh.getLastRow();
    if (last > 1 && whats) {
      var check = sh.getRange(Math.max(2, last - 4), 1, Math.min(5, last - 1), 4).getValues();
      for (var i = 0; i < check.length; i++) {
        var quando = check[i][0], fone = (check[i][3] || '').toString().trim();
        if (fone === whats && quando instanceof Date && (new Date() - quando) < 120000) {
          return ContentService.createTextOutput('duplicado');
        }
      }
    }

    var agora = new Date();
    sh.appendRow([agora, nome, email, whats,
      d.utm_source || '', d.utm_medium || '', d.utm_campaign || '',
      d.pagina || '', '']);

    var linha = sh.getLastRow(), resultado = '';
    try { resultado = notificar(nome, email, whats, d, agora); }
    catch (errMail) { resultado = 'ERRO: ' + errMail; }
    sh.getRange(linha, COLUNAS.length).setValue(resultado);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('erro: ' + err);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function notificar(nome, email, whats, d, agora) {
  var lista = EMAIL_AVISO.split(',').map(function (x) { return x.trim(); })
    .filter(function (x) { return x.indexOf('@') > 0; });
  if (!lista.length) return 'sem destinatarios';

  var digitos = whats.replace(/\D/g, '');
  var link = digitos ? 'https://wa.me/' + (digitos.length <= 11 ? '55' + digitos : digitos) : '';
  var quando = Utilities.formatDate(agora, FUSO, "dd/MM/yyyy 'as' HH:mm");
  var origem = [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / ');
  var planilha = 'https://docs.google.com/spreadsheets/d/' + PLANILHA_ID + '/edit';
  var primeiro = (nome || '').split(' ')[0];

  var FUNDO = '#F8F2EA', CARTAO = '#FFFFFF', BORDA = '#E4D9C8', VINHO = '#6E1F2A', ESCURO = '#2A1015';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function linhaHtml(rotulo, valor, href, ultima) {
    if (!valor) return '';
    var borda = ultima ? '' : 'border-bottom:1px solid ' + BORDA + ';';
    var conteudo = href
      ? '<a href="' + esc(href) + '" style="color:' + VINHO + ';text-decoration:underline;word-break:break-all;">' + esc(valor) + '</a>'
      : '<span style="color:#23161A;font-weight:bold;word-break:break-word;">' + esc(valor) + '</span>';
    return '<tr>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#8a7d6e;vertical-align:top;width:34%;background:' + CARTAO + ';">' + esc(rotulo) + '</td>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#23161A;vertical-align:top;background:' + CARTAO + ';">' + conteudo + '</td>' +
      '</tr>';
  }

  var linhas =
    linhaHtml('Nome', nome) +
    linhaHtml('E-mail', email, email ? 'mailto:' + email : null) +
    linhaHtml('WhatsApp', whats, link || null) +
    linhaHtml('Origem', origem || 'acesso direto') +
    linhaHtml('Pagina', d.pagina, d.pagina) +
    linhaHtml('Recebido em', quando, null, true);

  var botao = link
    ? '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:28px 20px 10px;text-align:center;background:' + CARTAO + ';">' +
        '<a href="' + esc(link) + '" style="display:inline-block;background:' + VINHO + ';padding:16px 34px;font:bold 15px Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">' +
        'Chamar ' + esc(primeiro || 'a pessoa') + ' no WhatsApp</a>' +
        '</td></tr>'
    : '';

  var html =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
  '<body bgcolor="' + FUNDO + '" style="margin:0;padding:0;background:' + FUNDO + ';">' +
  '<div style="display:none;max-height:0;overflow:hidden;">Novo contato: ' + esc(nome) + '</div>' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + FUNDO + '" style="background:' + FUNDO + ';">' +
  '<tr><td align="center" bgcolor="' + FUNDO + '" style="padding:24px 12px;background:' + FUNDO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="max-width:520px;background:' + CARTAO + ';border-radius:16px;overflow:hidden;">' +
  '<tr><td bgcolor="' + ESCURO + '" style="padding:26px 20px;background:' + ESCURO + ';">' +
  '<div style="font:bold 11px Arial,sans-serif;letter-spacing:2.5px;color:#BFA05A;text-transform:uppercase;">Thaisa Rivello</div>' +
  '<div style="font:bold 30px Georgia,serif;color:#ffffff;padding-top:6px;letter-spacing:-0.5px;">NOVO CONTATO</div>' +
  '<div style="font:14px Arial,sans-serif;color:rgba(255,255,255,0.72);padding-top:8px;line-height:1.5;">Alguém preencheu o formulário do site pedindo para conversar.</div>' +
  '</td></tr>' +
  '<tr><td bgcolor="' + CARTAO + '" style="padding:0;background:' + CARTAO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="background:' + CARTAO + ';">' +
  linhas + botao +
  '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:16px 20px 28px;text-align:center;background:' + CARTAO + ';">' +
  '<a href="' + esc(planilha) + '" style="font:13px Arial,sans-serif;color:#8a7d6e;text-decoration:underline;">Ver todos os contatos na planilha</a>' +
  '</td></tr></table></td></tr></table>' +
  '<div style="font:11px Arial,sans-serif;color:#a89a86;padding-top:16px;text-align:center;">Aviso automático · Thaisa Rivello</div>' +
  '</td></tr></table></body></html>';

  var texto = 'NOVO CONTATO\n\nNome: ' + (nome || '-') +
    '\nEmail: ' + (email || '-') +
    '\nWhatsApp: ' + (whats || '-') +
    '\nOrigem: ' + (origem || '-') +
    '\nPagina: ' + (d.pagina || '-') +
    '\nRecebido em: ' + quando +
    (link ? '\n\nAbrir conversa: ' + link : '');

  var assunto = 'Novo contato pelo site - Thaisa Rivello - ' + (nome || 'sem nome');
  var res = [];
  for (var i = 0; i < lista.length; i++) {
    try {
      MailApp.sendEmail({ to: lista[i], subject: assunto, body: texto, htmlBody: html, name: 'Thaisa Rivello' });
      res.push('OK ' + lista[i]);
    } catch (e1) {
      try {
        GmailApp.sendEmail(lista[i], assunto, texto, { htmlBody: html, name: 'Thaisa Rivello' });
        res.push('OK(gmail) ' + lista[i]);
      } catch (e2) { res.push('FALHOU ' + lista[i] + ' (' + e2 + ')'); }
    }
  }
  return res.join(' | ');
}

function testar() {
  Logger.log(salvarLead({
    nome: 'Teste', email: 'teste@teste.com', whatsapp: '19999999999',
    utm_source: 'instagram', utm_medium: 'bio', utm_campaign: 'lancamento',
    pagina: 'https://thaisarivello.com.br/'
  }).getContent());
}
