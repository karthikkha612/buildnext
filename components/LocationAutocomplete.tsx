import React, { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

type Props = {
  value: string;
  onSelect: (
    address: string,
    lat?: string,
    lon?: string
  ) => void;
};

export default function LocationAutocomplete({
  value,
  onSelect,
}: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchLocation(query);
    }, 500);

    return () => clearTimeout(timeout);
  }, [query]);

  const searchLocation = async (text: string) => {
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          text
        )}&limit=5`,
        {
          headers: {
            'User-Agent': 'BuildNext/1.0',
          },
        }
      );

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.log('Location Search Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    setQuery(item.display_name);
    setResults([]);

    onSelect(
      item.display_name,
      item.lat,
      item.lon
    );
  };

  return (
    <View>
      <TextInput
        value={query}
        placeholder="Search site location..."
        placeholderTextColor="#9CA3AF"
        onChangeText={(text) => {
  setQuery(text);
  onSelect(text, '', '');
}}
        style={styles.input}
      />

      {loading && (
        <ActivityIndicator
          size="small"
          style={{ marginTop: 8 }}
        />
      )}

      {results.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
  keyboardShouldPersistTaps="handled"
>
  {results.map((item) => (
    <TouchableOpacity
      key={item.place_id}
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
    >
      <Text style={styles.resultText}>
        {item.display_name}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
  },

  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    maxHeight: 220,
    overflow: 'hidden',
  },

  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  resultText: {
    fontSize: 13,
    color: '#374151',
  },
});