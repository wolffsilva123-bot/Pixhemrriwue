import { CircleDollarSign, Copy, ShieldCheck, Smartphone } from 'lucide-react';
import { PIX_PAYMENT_CONFIG } from '../constants/pixData';

const PAYMENT_STEPS = [
  {
    number: '01',
    icon: Copy,
    title: 'Copie a chave Pix oficial',
    description:
      'Toque no botão "Copiar chave Pix" no painel principal acima para salvar a chave na memória do seu celular ou computador.',
  },
  {
    number: '02',
    icon: Smartphone,
    title: 'Abra o aplicativo do seu banco',
    description:
      'Entre na sua conta bancária pelo celular, acesse a área Pix e escolha a opção "Transferir" ou "Pagar com chave".',
  },
  {
    number: '03',
    icon: CircleDollarSign,
    title: 'Cole a chave e informe o valor',
    description:
      'Cole a chave copiada no campo solicitado pelo banco e digite exatamente o valor combinado para o pagamento.',
  },
  {
    number: '04',
    icon: ShieldCheck,
    title: 'Confirme o recebedor e finalize',
    description: `Antes de autorizar com sua senha, confira se aparece "${PIX_PAYMENT_CONFIG.recipientName}" e o banco "${PIX_PAYMENT_CONFIG.bankName}".`,
  },
] as const;

export function PaymentInstructions() {
  return (
    <section id="instrucoes" aria-labelledby="instrucoes-heading" className="pt-14 sm:pt-16">
      <div className="max-w-2xl">
        <p className="font-display text-sm font-bold text-[#FFE600]">Guia rápido de transferência</p>
        <h2
          id="instrucoes-heading"
          className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance"
        >
          Como pagar via Pix em poucos segundos
        </h2>
        <p className="mt-3 text-base text-slate-300 leading-relaxed">
          Siga as quatro etapas abaixo no aplicativo do seu banco. A compensação é instantânea, 24 horas por dia.
        </p>
      </div>

      <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        {PAYMENT_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.number}
              className="group rounded-2xl bg-[#081A3B]/90 hover:bg-[#0B224D] border border-[#1A3970] hover:border-[#009EE3]/60 p-6 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#041024] border border-[#FFE600]/35 font-mono text-sm font-bold tabular-nums text-[#FFE600]">
                  {step.number}
                </span>
                <Icon
                  className="w-5 h-5 text-[#009EE3] group-hover:text-[#FFE600] transition-colors duration-200 shrink-0"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-5 font-display text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
