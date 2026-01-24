"use client";

import type { HTMLAttributes, PropsWithChildren } from "react";
import { Fragment, useContext, useState } from "react";
import { type CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarProps as AriaCalendarProps, DateValue } from "react-aria-components";
import {
    Calendar as AriaCalendar,
    CalendarContext as AriaCalendarContext,
    CalendarGrid as AriaCalendarGrid,
    CalendarGridBody as AriaCalendarGridBody,
    CalendarGridHeader as AriaCalendarGridHeader,
    CalendarHeaderCell as AriaCalendarHeaderCell,
    CalendarStateContext as AriaCalendarStateContext,
    Heading as AriaHeading,
    useSlottedContext,
} from "react-aria-components";
import { Button } from "@/components/ui/button";
import { cx } from "@/utils/cx";
import { CalendarCell } from "./cell";
import { DateInput } from "./date-input";

export const CalendarContextProvider = ({ children }: PropsWithChildren) => {
    const [value, onChange] = useState<DateValue | null>(null);
    const [focusedValue, onFocusChange] = useState<DateValue | undefined>();

    return <AriaCalendarContext.Provider value={{ value, onChange, focusedValue, onFocusChange }}>{children}</AriaCalendarContext.Provider>;
};

const PresetButton = ({ value, children, ...props }: HTMLAttributes<HTMLButtonElement> & { value: CalendarDate }) => {
    const context = useContext(AriaCalendarStateContext);

    if (!context) {
        throw new Error("Preset must be used within a Calendar component");
    }

    const handleClick = () => {
        context.setValue(value);
        context.setFocusedDate(value);
    };

    return (
        <Button
            {...props}
            size="default"
            variant="secondary"
            onClick={handleClick}
        >
            {children}
        </Button>
    );
};

interface CalendarProps extends AriaCalendarProps<DateValue> {
    /** The dates to highlight. */
    highlightedDates?: DateValue[];
}

export const Calendar = ({ highlightedDates, className, ...props }: CalendarProps) => {
    const context = useSlottedContext(AriaCalendarContext)!;

    const ContextWrapper = context ? Fragment : CalendarContextProvider;

    return (
        <ContextWrapper>
            <AriaCalendar {...props} className={(state) => cx("flex flex-col gap-3", typeof className === "function" ? className(state) : className)}>
                <header className="flex items-center justify-between">
                    <Button slot="previous" size="icon-sm" variant="ghost" className="size-8">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <AriaHeading className="text-sm font-semibold text-fg-secondary" />
                    <Button slot="next" size="icon-sm" variant="ghost" className="size-8">
                        <ChevronRight className="size-4" />
                    </Button>
                </header>

                <div className="flex gap-3">
                    <DateInput className="flex-1" />
                    <PresetButton value={today(getLocalTimeZone())}>Today</PresetButton>
                </div>

                <AriaCalendarGrid weekdayStyle="short" className="w-max">
                    <AriaCalendarGridHeader className="border-b-4 border-transparent">
                        {(day) => (
                            <AriaCalendarHeaderCell className="p-0">
                                <div className="flex size-10 items-center justify-center text-sm font-medium text-secondary">{day.slice(0, 2)}</div>
                            </AriaCalendarHeaderCell>
                        )}
                    </AriaCalendarGridHeader>
                    <AriaCalendarGridBody className="[&_td]:p-0 [&_tr]:border-b-4 [&_tr]:border-transparent [&_tr:last-of-type]:border-none">
                        {(date) => (
                            <CalendarCell date={date} isHighlighted={highlightedDates?.some((highlightedDate) => date.compare(highlightedDate) === 0)} />
                        )}
                    </AriaCalendarGridBody>
                </AriaCalendarGrid>
            </AriaCalendar>
        </ContextWrapper>
    );
};
