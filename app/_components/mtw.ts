import type { ElementType } from "react";
import {
  Button as MaterialButton,
  Card as MaterialCard,
  CardBody as MaterialCardBody,
  Chip as MaterialChip,
  IconButton as MaterialIconButton,
  Input as MaterialInput,
  Menu as MaterialMenu,
  MenuHandler as MaterialMenuHandler,
  MenuItem as MaterialMenuItem,
  MenuList as MaterialMenuList,
  Option as MaterialOption,
  Select as MaterialSelect,
  Typography as MaterialTypography,
} from "@material-tailwind/react";

const asElement = (component: unknown): ElementType => component as ElementType;

export const Button = asElement(MaterialButton);
export const Card = asElement(MaterialCard);
export const CardBody = asElement(MaterialCardBody);
export const Chip = asElement(MaterialChip);
export const IconButton = asElement(MaterialIconButton);
export const Input = asElement(MaterialInput);
export const Menu = asElement(MaterialMenu);
export const MenuHandler = asElement(MaterialMenuHandler);
export const MenuItem = asElement(MaterialMenuItem);
export const MenuList = asElement(MaterialMenuList);
export const Option = asElement(MaterialOption);
export const Select = asElement(MaterialSelect);
export const Typography = asElement(MaterialTypography);
