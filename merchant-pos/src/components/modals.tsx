import { useAppStore } from "~/store";
import Hero from "./modals/main-modal";
import PaymentModal from "./modals/payment-modal";
import SuccessModal from "./modals/success-modal";

const Modals = {
  HERO: Hero,
  PAYMENT: PaymentModal,
  SUCCESS: SuccessModal,
};

const Modal = () => {
  const {
    modal: { state },
  } = useAppStore();

  if (state) {
    const Child = state && Modals[state];

    return <Child />;
  }
};

export default Modal;
