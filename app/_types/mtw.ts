import type { ElementType } from "react";
import {
  Alert as MaterialAlert,
  Button as MaterialButton,
  Card as MaterialCard,
  CardBody as MaterialCardBody,
  Carousel as MaterialCarousel,
  Chip as MaterialChip,
  IconButton as MaterialIconButton,
  Input as MaterialInput,
  Menu as MaterialMenu,
  MenuHandler as MaterialMenuHandler,
  MenuItem as MaterialMenuItem,
  MenuList as MaterialMenuList,
  Option as MaterialOption,
  Select as MaterialSelect,
  Spinner as MaterialSpinner,
  Timeline as MaterialTimeline,
  TimelineBody as MaterialTimelineBody,
  TimelineConnector as MaterialTimelineConnector,
  TimelineHeader as MaterialTimelineHeader,
  TimelineIcon as MaterialTimelineIcon,
  TimelineItem as MaterialTimelineItem,
  Typography as MaterialTypography,
} from "@material-tailwind/react";

const asElement = (component: unknown): ElementType => component as ElementType;

export const Alert = asElement(MaterialAlert);
export const Button = asElement(MaterialButton);
export const Card = asElement(MaterialCard);
export const CardBody = asElement(MaterialCardBody);
export const Carousel = asElement(MaterialCarousel);
export const Chip = asElement(MaterialChip);
export const IconButton = asElement(MaterialIconButton);
export const Input = asElement(MaterialInput);
export const Menu = asElement(MaterialMenu);
export const MenuHandler = asElement(MaterialMenuHandler);
export const MenuItem = asElement(MaterialMenuItem);
export const MenuList = asElement(MaterialMenuList);
export const Option = asElement(MaterialOption);
export const Select = asElement(MaterialSelect);
export const Spinner = asElement(MaterialSpinner);
export const Timeline = asElement(MaterialTimeline);
export const TimelineBody = asElement(MaterialTimelineBody);
export const TimelineConnector = asElement(MaterialTimelineConnector);
export const TimelineHeader = asElement(MaterialTimelineHeader);
export const TimelineIcon = asElement(MaterialTimelineIcon);
export const TimelineItem = asElement(MaterialTimelineItem);
export const Typography = asElement(MaterialTypography);
