
// localStorage Reset Script
console.log('�� Clearing datatables localStorage...');
for (let i = localStorage.length - 1; i >= 0; i--) {
  const key = localStorage.key(i);
  if (key && key.includes('table-')) {
    console.log('Removing:', key);
    localStorage.removeItem(key);
  }
}
console.log('✅ localStorage cleared');

