#include <unordered_map>
#include <vector>

std::vector<int> twoSum(const std::vector<int>& numbers, int target) {
    std::unordered_map<int, int> seen;

    for (int index = 0; index < static_cast<int>(numbers.size()); ++index) {
        const int complement = target - numbers[index];
        const auto match = seen.find(complement);

        if (match != seen.end()) {
            return {match->second, index};
        }

        seen[numbers[index]] = index;
    }

    return {};
}