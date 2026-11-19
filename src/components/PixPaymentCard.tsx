import { Building2, Check, Copy, ShieldCheck, UserCheck, Wallet } from 'lucide-react';
import { PIX_PAYMENT_CONFIG } from '../constants/pixData';
import { MercadoPagoMark, PixDiamondIcon } from './PixBrandIcons';

interface PixPaymentCardProps {
  copied: boolean;
  copyError: boolean;
  onCopyPixKey: () => void;
}

export function PixPaymentCard({ copied, copyError, onCopyPixKey }: PixPaymentCardProps) {
  return (
    <section
      id="dados-pix"
      aria-labelledby="dados-pix-heading"
      className="rounded-3xl overflow-hidden bg-white shadow-[0_28px_70px_-15px_rgba(0,158,227,0.34)] ring-1 ring-white/15"
    >
      {/* Premium Mercado Pago Blue Gradient Header */}
      <div
        className="relative overflow-hidden bg-gradient-to-br from-[#002B6B] via-[#005EB8] to-[#009EE3] p-6 sm:p-8 text-white"
        style={{
          backgroundImage:
            'radial-gradient(circle at 92% 14%, rgba(255, 230, 0, 0.2), transparent 42%), linear-gradient(135deg, #002B6B 0%, #005EB8 52%, #009EE3 100%)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <PixDiamondIcon className="w-5 h-5 text-[#FFE600]" />
            </span>
            <div>
              <p className="text-xs font-semibold text-sky-100">Pagamento instantâneo</p>
              <p className="font-display text-sm font-bold tracking-tight text-white">
                Transferência via Pix
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl bg-[#041838]/55 border border-white/15 px-3.5 py-2"
            aria-label="Banco Mercado Pago"
          >
            <MercadoPagoMark className="w-6 h-4 text-[#FFE600] shrink-0" />
            <span className="font-display text-sm font-extrabold tracking-wide text-white uppercase whitespace-nowrap">
              {PIX_PAYMENT_CONFIG.bankName}
            </span>
          </div>
        </div>

        {/* Highlighted Recipient Name */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-sky-100/90">Beneficiário / Recebedor</p>
          <h2
            id="dados-pix-heading"
            className="mt-1.5 font-display text-xl sm:text-2xl md:text-[1.75rem] font-extrabold tracking-tight text-white uppercase leading-tight text-balance"
          >
            {PIX_PAYMENT_CONFIG.recipientName}
          </h2>
        </div>

        {/* Highlighted Payment Area without inventing monetary values */}
        <div className="mt-5 rounded-2xl bg-[#041838]/60 border border-white/15 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#FFE600] text-[#041838] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Área de pagamento Pix</p>
              <p className="text-xs sm:text-sm text-sky-100/90">
                Informe o valor combinado diretamente no aplicativo do seu banco
              </p>
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-[11px] font-semibold text-sky-200 uppercase tracking-wider">
              Instituição
            </p>
            <p className="font-display text-sm font-extrabold text-[#FFE600] uppercase">
              {PIX_PAYMENT_CONFIG.bankName}
            </p>
          </div>
        </div>
      </div>

      {/* High-Contrast White Payment Body */}
      <div className="p-6 sm:p-8 bg-white text-slate-900">
        <dl className="divide-y divide-slate-100">
          <div className="pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <dt className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0066CC] shrink-0" aria-hidden="true" />
              <span>Nome completo do recebedor</span>
            </dt>
            <dd className="font-display text-base sm:text-lg font-bold text-slate-900 sm:text-right uppercase">
              {PIX_PAYMENT_CONFIG.recipientName}
            </dd>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <dt className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0066CC] shrink-0" aria-hidden="true" />
              <span>Banco recebedor</span>
            </dt>
            <dd className="font-display text-base sm:text-lg font-extrabold text-[#005EB8] flex items-center gap-2 sm:justify-end uppercase">
              <MercadoPagoMark className="w-6 h-4 shrink-0" />
              <span>{PIX_PAYMENT_CONFIG.bankName}</span>
            </dd>
          </div>
        </dl>

        {/* Pix Key Vault */}
        <div className="mt-4 pt-5 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="font-display text-sm font-bold text-slate-900">
              Chave Pix para pagamento
            </span>
            <span className="text-xs font-medium text-slate-500">
              Copie com um toque abaixo
            </span>
          </div>

          <div className="rounded-2xl bg-[#F0F7FF] border-2 border-[#C3DFFA] px-4 py-4 flex items-center justify-between gap-3">
            <code
              id="pix-key-value"
              className="font-mono text-base sm:text-lg font-bold text-[#06204A] break-all select-all"
            >
              {PIX_PAYMENT_CONFIG.pixKey}
            </code>
          </div>

          {/* Large Modern Gradient Copy Button */}
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={onCopyPixKey}
              className={`w-full min-h-[54px] px-6 py-3.5 rounded-2xl font-display font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 whitespace-nowrap cursor-pointer ${
                copied
                  ? 'bg-gradient-to-r from-[#047857] to-[#059669] text-white shadow-[0_14px_30px_-8px_rgba(5,150,105,0.5)] focus-visible:ring-emerald-700'
                  : 'bg-gradient-to-r from-[#0044B3] via-[#006EE6] to-[#009EE3] hover:brightness-110 text-white shadow-[0_14px_32px_-8px_rgba(0,110,230,0.55)] focus-visible:ring-[#006EE6]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Chave Pix copiada com sucesso</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Copiar chave Pix</span>
                </>
              )}
            </button>

            <div aria-live="polite">
              {copied && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 text-sm text-emerald-950"
                >
                  <ShieldCheck
                    className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="leading-relaxed">
                    <strong className="font-bold">Chave Pix copiada!</strong> Abra o aplicativo do
                    seu banco, entre na área Pix, cole a chave e confirme os dados de{' '}
                    <span className="font-semibold">{PIX_PAYMENT_CONFIG.recipientName}</span>.
                  </p>
                </div>
              )}

              {copyError && !copied && (
                <div
                  role="alert"
                  className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3.5 text-sm text-amber-950"
                >
                  Não foi possível copiar automaticamente neste navegador. Selecione a chave acima e
                  toque em copiar manualmente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
