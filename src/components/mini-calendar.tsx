import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity } from 'react-native';

// Format a Date to YYYY-MM-DD using LOCAL date parts (avoids UTC offset shifting the day)
const toLocalDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

interface MiniCalendarProps {
    visible: boolean;
    title: string;
    selectedDate: Date;
    minimumDate?: Date;
    maximumDate?: Date;
    onConfirm: (date: Date) => void;
    onCancel: () => void;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function MiniCalendar({
    visible,
    title,
    selectedDate,
    minimumDate,
    maximumDate,
    onConfirm,
    onCancel,
}: MiniCalendarProps) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    const [picked, setPicked] = useState(new Date(selectedDate));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const isDisabled = (day: number) => {
        const d = new Date(year, month, day);
        if (minimumDate && d < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate())) return true;
        if (maximumDate && d > new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate())) return true;
        return false;
    };

    const isSelected = (day: number) => {
        return (
            picked.getFullYear() === year &&
            picked.getMonth() === month &&
            picked.getDate() === day
        );
    };

    const isToday = (day: number) => {
        const now = new Date();
        return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    };

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);

    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(31,21,12,0.50)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
                onPress={onCancel}
            >
                <Pressable
                    style={{ backgroundColor: '#FAF8F3', borderRadius: 28, padding: 20, width: '100%', maxWidth: 340 }}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F150C', textAlign: 'center', marginBottom: 16 }}>
                        {title}
                    </Text>

                    {/* Month navigator */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
                            <Text style={{ fontSize: 18, color: '#412D15', fontWeight: '700' }}>‹</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F150C' }}>
                            {MONTHS[month]} {year}
                        </Text>
                        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
                            <Text style={{ fontSize: 18, color: '#412D15', fontWeight: '700' }}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Day labels */}
                    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                        {DAYS.map(d => (
                            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#A0693A' }}>{d}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Cells */}
                    {Array.from({ length: cells.length / 7 }, (_, row) => (
                        <View key={row} style={{ flexDirection: 'row', marginVertical: 2 }}>
                            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                                if (!day) return <View key={col} style={{ flex: 1 }} />;
                                const selected = isSelected(day);
                                const disabled = isDisabled(day);
                                const today = isToday(day);
                                return (
                                    <TouchableOpacity
                                        key={col}
                                        disabled={disabled}
                                        onPress={() => setPicked(new Date(year, month, day))}
                                        style={{
                                            flex: 1,
                                            aspectRatio: 1,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 999,
                                            backgroundColor: selected ? '#412D15' : 'transparent',
                                            borderWidth: today && !selected ? 1 : 0,
                                            borderColor: '#412D15',
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 13,
                                            fontWeight: selected ? '700' : '500',
                                            color: disabled ? '#CCC' : selected ? '#FAF8F3' : '#1F150C',
                                        }}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                        <TouchableOpacity
                            onPress={onCancel}
                            style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#412D15', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#412D15' }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onConfirm(picked)}
                            style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#412D15', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FAF8F3' }}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

export default MiniCalendar;
